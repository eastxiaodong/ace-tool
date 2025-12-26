/**
 * 索引管理器 - 管理文件收集、索引和搜索操作
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios, { AxiosInstance } from 'axios';
import iconv from 'iconv-lite';
import ignore from 'ignore';
import { sendMcpLog } from '../mcpLogger.js';
import { getIndexFilePath } from '../utils/projectDetector.js';
import { getUploadStrategy } from '../config.js';

type IgnoreInstance = ReturnType<typeof ignore>;

/**
 * Blob 接口
 */
interface Blob {
  path: string;
  content: string;
}

/**
 * 索引结果接口
 */
interface IndexResult {
  status: string;
  message: string;
  stats?: {
    total_blobs: number;
    existing_blobs: number;
    new_blobs: number;
    failed_batches?: number;
  };
}

/**
 * 使用多种编码尝试读取文件
 */
async function readFileWithEncoding(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  const encodings = ['utf-8', 'gbk', 'gb2312', 'latin1'];

  for (const encoding of encodings) {
    try {
      const content = iconv.decode(buffer, encoding);
      const replacementChars = (content.match(/\uFFFD/g) || []).length;

      if (content.length > 0) {
        if (content.length < 100) {
          if (replacementChars > 5) continue;
        } else {
          if (replacementChars / content.length > 0.05) continue;
        }
      }

      if (encoding !== 'utf-8') {
        // 非 UTF-8 编码，静默处理
      }
      return content;
    } catch {
      continue;
    }
  }

  const content = iconv.decode(buffer, 'utf-8');
  return content;
}

/**
 * 计算 blob 名称（SHA-256 哈希）
 */
function calculateBlobName(filePath: string, content: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(filePath, 'utf-8');
  hash.update(content, 'utf-8');
  return hash.digest('hex');
}

/**
 * 睡眠工具函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 索引管理器类
 */
export class IndexManager {
  private projectRoot: string;
  private baseUrl: string;
  private token: string;
  private textExtensions: Set<string>;
  private maxLinesPerBlob: number;
  private excludePatterns: string[];
  private indexFilePath: string;
  private httpClient: AxiosInstance;

  constructor(
    projectRoot: string,
    baseUrl: string,
    token: string,
    textExtensions: Set<string>,
    _batchSize: number,  // 保留用于向后兼容，实际使用自适应策略
    maxLinesPerBlob: number = 800,
    excludePatterns: string[] = []
  ) {
    this.projectRoot = projectRoot;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.textExtensions = textExtensions;
    // batchSize 参数保留用于向后兼容，但实际使用自适应策略
    this.maxLinesPerBlob = maxLinesPerBlob;
    this.excludePatterns = excludePatterns;
    this.indexFilePath = getIndexFilePath(projectRoot);

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
  }

  /**
   * 加载 .gitignore 文件
   */
  private loadGitignore(): IgnoreInstance | null {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      const patterns = content.split('\n');
      const ig = ignore().add(patterns);
      return ig;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查路径是否应该被排除
   */
  private shouldExclude(
    filePath: string,
    gitignoreSpec: IgnoreInstance | null
  ): boolean {
    try {
      const relativePath = path.relative(this.projectRoot, filePath);
      const pathStr = relativePath.replace(/\\/g, '/');

      if (gitignoreSpec) {
        const isDir = fs.statSync(filePath).isDirectory();
        const testPath = isDir ? pathStr + '/' : pathStr;
        if (gitignoreSpec.ignores(testPath)) {
          return true;
        }
      }

      const pathParts = pathStr.split('/');
      for (const pattern of this.excludePatterns) {
        for (const part of pathParts) {
          if (this.matchPattern(part, pattern)) {
            return true;
          }
        }
        if (this.matchPattern(pathStr, pattern)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * 简单的模式匹配
   */
  private matchPattern(str: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  /**
   * 加载索引数据
   */
  private loadIndex(): string[] {
    if (!fs.existsSync(this.indexFilePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.indexFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      sendMcpLog('error', `❌ 加载索引失败: ${error}`);
      return [];
    }
  }

  /**
   * 保存索引数据
   */
  private saveIndex(blobNames: string[]): void {
    try {
      const content = JSON.stringify(blobNames, null, 2);
      fs.writeFileSync(this.indexFilePath, content, 'utf-8');
    } catch (error) {
      sendMcpLog('error', `❌ 保存索引失败: ${error}`);
      throw error;
    }
  }

  /**
   * 将文件内容分割为多个 blob
   */
  private splitFileContent(filePath: string, content: string): Blob[] {
    const lines: string[] = [];
    let start = 0;

    for (let i = 0; i < content.length; i++) {
      if (content[i] === '\n') {
        lines.push(content.substring(start, i + 1));
        start = i + 1;
      } else if (content[i] === '\r') {
        if (i + 1 < content.length && content[i + 1] === '\n') {
          lines.push(content.substring(start, i + 2));
          start = i + 2;
          i++;
        } else {
          lines.push(content.substring(start, i + 1));
          start = i + 1;
        }
      }
    }

    if (start < content.length) {
      lines.push(content.substring(start));
    }

    const totalLines = lines.length;

    if (totalLines <= this.maxLinesPerBlob) {
      return [{ path: filePath, content }];
    }

    const blobs: Blob[] = [];
    const numChunks = Math.ceil(totalLines / this.maxLinesPerBlob);

    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      const startLine = chunkIdx * this.maxLinesPerBlob;
      const endLine = Math.min(startLine + this.maxLinesPerBlob, totalLines);
      const chunkLines = lines.slice(startLine, endLine);
      const chunkContent = chunkLines.join('');
      const chunkPath = `${filePath}#chunk${chunkIdx + 1}of${numChunks}`;
      blobs.push({ path: chunkPath, content: chunkContent });
    }

    return blobs;
  }

  /**
   * 收集所有文本文件
   */
  private async collectFiles(): Promise<Blob[]> {
    const blobs: Blob[] = [];
    let excludedCount = 0;
    const gitignoreSpec = this.loadGitignore();

    const walkDir = async (dirPath: string): Promise<void> => {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!this.shouldExclude(fullPath, gitignoreSpec)) {
            await walkDir(fullPath);
          } else {
            excludedCount++;
          }
        } else if (entry.isFile()) {
          if (this.shouldExclude(fullPath, gitignoreSpec)) {
            excludedCount++;
            continue;
          }

          const ext = path.extname(entry.name).toLowerCase();
          if (!this.textExtensions.has(ext)) {
            continue;
          }

          try {
            const relativePath = path.relative(this.projectRoot, fullPath);
            if (relativePath.startsWith('..')) {
              continue;
            }

            const content = await readFileWithEncoding(fullPath);
            const fileBlobs = this.splitFileContent(relativePath, content);
            blobs.push(...fileBlobs);
          } catch (error) {
            // 静默处理读取失败
          }
        }
      }
    };

    await walkDir(this.projectRoot);
    return blobs;
  }

  /**
   * 使用指数退避策略重试请求
   */
  private async retryRequest<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const axiosError = error as { code?: string; response?: { status: number; data?: unknown } };

        // Token 失效检测 - 不重试，直接抛出友好错误
        if (axiosError.response?.status === 401) {
          sendMcpLog('error', '🔑 Token 已失效或无效，请检查配置');
          throw new Error('Token 已失效或无效，请更新 ACE_TOKEN 环境变量');
        }

        // 权限被拒绝 - 可能被官方制裁
        if (axiosError.response?.status === 403) {
          sendMcpLog('error', '🚫 访问被拒绝，Token 可能已被禁用');
          throw new Error('访问被拒绝，Token 可能已被官方禁用，请联系服务提供商');
        }

        // SSL 证书错误检测 - 不重试
        if (axiosError.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
            axiosError.code === 'CERT_HAS_EXPIRED' ||
            axiosError.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
            lastError.message.includes('certificate') ||
            lastError.message.includes('altnames')) {
          sendMcpLog('error', '🔐 SSL 证书验证失败，请检查 ACE_BASE_URL 配置是否正确');
          throw new Error('SSL 证书验证失败，请检查 ACE_BASE_URL 配置是否正确，或联系服务提供商');
        }

        const isRetryable =
          axiosError.code === 'ECONNREFUSED' ||
          axiosError.code === 'ETIMEDOUT' ||
          axiosError.code === 'ENOTFOUND' ||
          (axiosError.response && axiosError.response.status >= 500);

        if (!isRetryable || attempt === maxRetries - 1) {
          // 提供更友好的网络错误提示
          let friendlyMessage = lastError.message;
          if (axiosError.code === 'ECONNREFUSED') {
            friendlyMessage = '无法连接到服务器，请检查网络或服务地址';
          } else if (axiosError.code === 'ETIMEDOUT') {
            friendlyMessage = '连接超时，请检查网络状况';
          } else if (axiosError.code === 'ENOTFOUND') {
            friendlyMessage = '无法解析服务器地址，请检查 ACE_BASE_URL 配置';
          }
          sendMcpLog('error', `❌ 请求失败 (${attempt + 1}次尝试): ${friendlyMessage}`);
          throw new Error(friendlyMessage);
        }

        const waitTime = retryDelay * Math.pow(2, attempt);
        sendMcpLog('warning', `⚠️ 请求失败 (${attempt + 1}/${maxRetries})，${waitTime}ms 后重试...`);
        await sleep(waitTime);
      }
    }

    throw lastError || new Error('All retries failed');
  }

  /**
   * 对项目进行索引（支持增量索引）
   */
  async indexProject(): Promise<IndexResult> {
    sendMcpLog('info', `📂 开始索引项目: ${this.projectRoot}`);

    try {
      sendMcpLog('info', '🔍 正在扫描文件...');
      const blobs = await this.collectFiles();

      if (blobs.length === 0) {
        sendMcpLog('warning', '⚠️ 未找到可索引的文本文件');
        return { status: 'error', message: 'No text files found in project' };
      }

      sendMcpLog('info', `📄 扫描完成，共发现 ${blobs.length} 个文件块`);

      // 加载已存在的索引数据
      const existingBlobNames = new Set(this.loadIndex());

      // 为所有收集的 blob 计算哈希值
      const blobHashMap = new Map<string, Blob>();
      for (const blob of blobs) {
        const blobHash = calculateBlobName(blob.path, blob.content);
        blobHashMap.set(blobHash, blob);
      }

      // 分离已存在和新的 blob
      const allBlobHashes = new Set(blobHashMap.keys());
      const existingHashes = new Set(
        [...allBlobHashes].filter((hash) => existingBlobNames.has(hash))
      );
      const newHashes = [...allBlobHashes].filter((hash) => !existingBlobNames.has(hash));
      const blobsToUpload = newHashes.map((hash) => blobHashMap.get(hash)!);

      sendMcpLog('info', `📊 增量索引: 已有 ${existingHashes.size} 个, 新增 ${newHashes.length} 个`);

      // 只上传新的 blob
      const uploadedBlobNames: string[] = [];
      let fatalError: string | null = null;

      // 辅助函数：保存当前进度
      const saveProgress = () => {
        const currentBlobNames = [...existingHashes, ...uploadedBlobNames];
        this.saveIndex(currentBlobNames);
        return currentBlobNames.length;
      };

      // 辅助函数：上传单个批次
      const uploadBatch = async (batchBlobs: Blob[], batchIdx: number, timeout: number) => {
        try {
          const result = await this.retryRequest(async () => {
            const response = await this.httpClient.post(
              `${this.baseUrl}/batch-upload`,
              { blobs: batchBlobs },
              { timeout }
            );
            return response.data;
          });

          const batchBlobNames = result.blob_names || [];
          if (batchBlobNames.length === 0) {
            sendMcpLog('warning', `⚠️ 批次 ${batchIdx} 返回空结果`);
            return { success: false, batchIdx, blobNames: [], error: '服务器返回空结果', fatal: false };
          }

          return { success: true, batchIdx, blobNames: batchBlobNames, error: null, fatal: false };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          sendMcpLog('error', `❌ 批次 ${batchIdx} 上传失败: ${errorMessage}`);

          // 检测致命错误（不应继续重试的错误）
          const isFatalError =
            errorMessage.includes('Token') ||
            errorMessage.includes('SSL') ||
            errorMessage.includes('证书') ||
            errorMessage.includes('访问被拒绝') ||
            errorMessage.includes('无法解析服务器');

          return { success: false, batchIdx, blobNames: [], error: errorMessage, fatal: isFatalError };
        }
      };

      if (blobsToUpload.length > 0) {
        // 获取自适应上传策略
        const strategy = getUploadStrategy(blobsToUpload.length);
        sendMcpLog('info', `📐 项目规模: ${strategy.scaleName} (批次大小: ${strategy.batchSize}, 并发: ${strategy.concurrency})`);

        // 待上传的文件队列（初始为所有需要上传的文件）
        let pendingBlobs = [...blobsToUpload];
        let currentBatchSize = strategy.batchSize;
        const maxRetryRounds = 3;  // 最多重试3轮
        let retryRound = 0;
        let totalBatchIdx = 0;

        while (pendingBlobs.length > 0 && retryRound < maxRetryRounds && !fatalError) {
          // 重试时使用更小的批次大小
          if (retryRound > 0) {
            currentBatchSize = Math.max(5, Math.floor(currentBatchSize / 2));  // 每轮减半，最小5个
            sendMcpLog('info', `🔄 第 ${retryRound} 轮重试: ${pendingBlobs.length} 个文件，批次大小调整为 ${currentBatchSize}`);
          }

          // 重新分批
          const batches: Blob[][] = [];
          for (let i = 0; i < pendingBlobs.length; i += currentBatchSize) {
            batches.push(pendingBlobs.slice(i, i + currentBatchSize));
          }

          const totalBatches = batches.length;
          if (retryRound === 0) {
            sendMcpLog('info', `⬆️ 开始上传 ${pendingBlobs.length} 个新文件块，共 ${totalBatches} 批`);
          }

          // 收集本轮失败的文件
          const failedBlobsInThisRound: Blob[] = [];

          // 并发上传当前轮次的批次
          for (let i = 0; i < batches.length; i += strategy.concurrency) {
            if (fatalError) break;

            const concurrentBatches = batches.slice(i, i + strategy.concurrency);

            if (retryRound === 0) {
              const batchNums = concurrentBatches.map((_, idx) => i + idx + 1);
              sendMcpLog('info', `📤 上传批次 ${batchNums.join(', ')}/${totalBatches}...`);
            } else {
              sendMcpLog('info', `📤 重试上传 ${concurrentBatches.length} 个批次...`);
            }

            const uploadPromises = concurrentBatches.map(async (batchBlobs) => {
              totalBatchIdx++;
              return uploadBatch(batchBlobs, totalBatchIdx, strategy.timeout);
            });

            const results = await Promise.all(uploadPromises);

            for (let j = 0; j < results.length; j++) {
              const result = results[j];
              if (result.success) {
                uploadedBlobNames.push(...result.blobNames);
              } else {
                if (result.fatal) {
                  fatalError = result.error;
                } else {
                  // 非致命错误，将该批次的文件加入重试队列
                  failedBlobsInThisRound.push(...concurrentBatches[j]);
                }
              }
            }

            // 每轮并发完成后保存进度
            if (uploadedBlobNames.length > 0) {
              const savedCount = saveProgress();
              sendMcpLog('info', `💾 进度已保存: ${savedCount} 个文件块`);
            }
          }

          // 更新待重试的文件列表
          pendingBlobs = failedBlobsInThisRound;
          retryRound++;
        }

        // 记录最终失败的文件数
        const finalFailedCount = pendingBlobs.length;
        if (finalFailedCount > 0 && !fatalError) {
          sendMcpLog('warning', `⚠️ ${finalFailedCount} 个文件在 ${maxRetryRounds} 轮重试后仍然失败`);
        }

        // 最终保存
        const allBlobNames = [...existingHashes, ...uploadedBlobNames];
        this.saveIndex(allBlobNames);

        // 根据结果返回不同状态
        if (fatalError) {
          if (uploadedBlobNames.length > 0) {
            const message = `部分索引成功: ${allBlobNames.length} 个文件块已保存 (已有: ${existingHashes.size}, 新增: ${uploadedBlobNames.length})。错误: ${fatalError}。请修复问题后重试，已完成的部分会被保留。`;
            sendMcpLog('warning', `⚠️ ${message}`);
            return {
              status: 'partial_success',
              message,
              stats: {
                total_blobs: allBlobNames.length,
                existing_blobs: existingHashes.size,
                new_blobs: uploadedBlobNames.length,
                failed_batches: finalFailedCount,
              },
            };
          } else if (existingHashes.size > 0) {
            const message = `本次上传失败，但保留了 ${existingHashes.size} 个已有索引。错误: ${fatalError}。请修复问题后重试。`;
            sendMcpLog('warning', `⚠️ ${message}`);
            return {
              status: 'partial_success',
              message,
              stats: {
                total_blobs: existingHashes.size,
                existing_blobs: existingHashes.size,
                new_blobs: 0,
                failed_batches: finalFailedCount,
              },
            };
          } else {
            sendMcpLog('error', `❌ ${fatalError}`);
            return { status: 'error', message: fatalError };
          }
        }

        if (finalFailedCount > 0 && uploadedBlobNames.length === 0 && existingHashes.size === 0) {
          const errorMsg = '所有文件上传失败，请检查网络连接和服务配置';
          sendMcpLog('error', `❌ ${errorMsg}`);
          return { status: 'error', message: errorMsg };
        }

        const message = finalFailedCount > 0
          ? `索引部分完成: ${allBlobNames.length} 个文件块 (已有: ${existingHashes.size}, 新增: ${uploadedBlobNames.length}, 失败: ${finalFailedCount})。重试可继续完成剩余部分。`
          : `Indexed ${allBlobNames.length} blobs (existing: ${existingHashes.size}, new: ${uploadedBlobNames.length})`;

        sendMcpLog('info', `✅ 索引完成: 共 ${allBlobNames.length} 个文件块`);

        return {
          status: finalFailedCount === 0 ? 'success' : 'partial_success',
          message,
          stats: {
            total_blobs: allBlobNames.length,
            existing_blobs: existingHashes.size,
            new_blobs: uploadedBlobNames.length,
            ...(finalFailedCount > 0 && { failed_files: finalFailedCount }),
          },
        };
      } else {
        sendMcpLog('info', '✅ 无需上传新文件，使用缓存索引');
      }

      // 无需上传时的返回
      const allBlobNames = [...existingHashes, ...uploadedBlobNames];
      this.saveIndex(allBlobNames);

      const message = `Indexed ${allBlobNames.length} blobs (existing: ${existingHashes.size}, new: ${uploadedBlobNames.length})`;
      sendMcpLog('info', `✅ 索引完成: 共 ${allBlobNames.length} 个文件块`);

      return {
        status: 'success',
        message,
        stats: {
          total_blobs: allBlobNames.length,
          existing_blobs: existingHashes.size,
          new_blobs: uploadedBlobNames.length,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendMcpLog('error', `❌ 索引项目失败: ${errorMessage}`);
      return { status: 'error', message: errorMessage };
    }
  }

  /**
   * 搜索代码上下文（自动增量索引）
   */
  async searchContext(query: string): Promise<string> {
    sendMcpLog('info', `🔎 开始搜索: ${query}`);

    try {
      // 自动索引
      const indexResult = await this.indexProject();
      if (indexResult.status === 'error') {
        sendMcpLog('error', `❌ 索引失败: ${indexResult.message}`);
        return `Error: Failed to index project. ${indexResult.message}`;
      }

      // 加载索引
      const blobNames = this.loadIndex();
      if (blobNames.length === 0) {
        sendMcpLog('error', '❌ 索引为空');
        return 'Error: No blobs found after indexing.';
      }

      // 执行搜索
      sendMcpLog('info', `🔍 正在搜索 ${blobNames.length} 个文件块...`);
      const payload = {
        information_request: query,
        blobs: {
          checkpoint_id: null,
          added_blobs: blobNames,
          deleted_blobs: [],
        },
        dialog: [],
        max_output_length: 0,
        disable_codebase_retrieval: false,
        enable_commit_retrieval: false,
      };

      const result = await this.retryRequest(async () => {
        const response = await this.httpClient.post(
          `${this.baseUrl}/agents/codebase-retrieval`,
          payload,
          { timeout: 60000 }
        );
        return response.data;
      }, 3, 2000);

      const formattedRetrieval = result.formatted_retrieval || '';

      if (!formattedRetrieval) {
        sendMcpLog('info', '📭 未找到相关代码');
        return 'No relevant code context found for your query.';
      }

      sendMcpLog('info', '✅ 搜索完成');
      return formattedRetrieval;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendMcpLog('error', `❌ 搜索失败: ${errorMessage}`);
      return `Error: ${errorMessage}`;
    }
  }
}
