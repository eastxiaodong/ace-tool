/**
 * 索引管理器 - 管理文件收集、索引和搜索操作
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios, { AxiosInstance } from 'axios';
import iconv from 'iconv-lite';
import ignore from 'ignore';
import { logger } from '../logger.js';
import { getIndexFilePath } from '../utils/projectDetector.js';

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
        logger.debug(`Read ${filePath} with encoding: ${encoding}`);
      }
      return content;
    } catch {
      continue;
    }
  }

  const content = iconv.decode(buffer, 'utf-8');
  logger.warning(`Read ${filePath} with utf-8 (some characters may be lost)`);
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
  private batchSize: number;
  private maxLinesPerBlob: number;
  private excludePatterns: string[];
  private indexFilePath: string;
  private httpClient: AxiosInstance;

  constructor(
    projectRoot: string,
    baseUrl: string,
    token: string,
    textExtensions: Set<string>,
    batchSize: number,
    maxLinesPerBlob: number = 800,
    excludePatterns: string[] = []
  ) {
    this.projectRoot = projectRoot;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.textExtensions = textExtensions;
    this.batchSize = batchSize;
    this.maxLinesPerBlob = maxLinesPerBlob;
    this.excludePatterns = excludePatterns;
    this.indexFilePath = getIndexFilePath(projectRoot);

    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    logger.info(`IndexManager initialized for project: ${projectRoot}`);
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
      logger.debug(`Loaded .gitignore with ${patterns.length} patterns`);
      return ig;
    } catch (error) {
      logger.warning(`Failed to load .gitignore: ${error}`);
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
      logger.error(`Failed to load index: ${error}`);
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
      logger.error(`Failed to save index: ${error}`);
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

    logger.info(`Split file ${filePath} (${totalLines} lines) into ${numChunks} chunks`);
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
            logger.warning(`Failed to read file: ${fullPath} - ${error}`);
          }
        }
      }
    };

    await walkDir(this.projectRoot);
    logger.info(`Collected ${blobs.length} blobs (excluded ${excludedCount} items)`);
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
        const axiosError = error as { code?: string; response?: { status: number } };
        const isRetryable =
          axiosError.code === 'ECONNREFUSED' ||
          axiosError.code === 'ETIMEDOUT' ||
          axiosError.code === 'ENOTFOUND' ||
          (axiosError.response && axiosError.response.status >= 500);

        if (!isRetryable || attempt === maxRetries - 1) {
          logger.error(`Request failed after ${attempt + 1} attempts: ${lastError.message}`);
          throw error;
        }

        const waitTime = retryDelay * Math.pow(2, attempt);
        logger.warning(`Request failed (attempt ${attempt + 1}/${maxRetries}). Retrying in ${waitTime}ms...`);
        await sleep(waitTime);
      }
    }

    throw lastError || new Error('All retries failed');
  }

  /**
   * 对项目进行索引（支持增量索引）
   */
  async indexProject(): Promise<IndexResult> {
    logger.info(`Indexing project: ${this.projectRoot}`);

    try {
      const blobs = await this.collectFiles();

      if (blobs.length === 0) {
        return { status: 'error', message: 'No text files found in project' };
      }

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

      logger.info(
        `Incremental indexing: total=${blobs.length}, existing=${existingHashes.size}, new=${newHashes.length}`
      );

      // 只上传新的 blob
      const uploadedBlobNames: string[] = [];
      const failedBatches: number[] = [];

      if (blobsToUpload.length > 0) {
        const totalBatches = Math.ceil(blobsToUpload.length / this.batchSize);
        logger.info(`Uploading ${blobsToUpload.length} new blobs in ${totalBatches} batches`);

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const startIdx = batchIdx * this.batchSize;
          const endIdx = Math.min(startIdx + this.batchSize, blobsToUpload.length);
          const batchBlobs = blobsToUpload.slice(startIdx, endIdx);

          logger.info(`Uploading batch ${batchIdx + 1}/${totalBatches} (${batchBlobs.length} blobs)`);

          try {
            const result = await this.retryRequest(async () => {
              const response = await this.httpClient.post(`${this.baseUrl}/batch-upload`, {
                blobs: batchBlobs,
              });
              return response.data;
            });

            const batchBlobNames = result.blob_names || [];
            if (batchBlobNames.length === 0) {
              logger.warning(`Batch ${batchIdx + 1} returned no blob names`);
              failedBatches.push(batchIdx + 1);
              continue;
            }

            uploadedBlobNames.push(...batchBlobNames);
            logger.info(`Batch ${batchIdx + 1} uploaded successfully`);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Batch ${batchIdx + 1} failed: ${errorMessage}`);
            failedBatches.push(batchIdx + 1);
          }
        }

        if (uploadedBlobNames.length === 0 && blobsToUpload.length > 0 && existingHashes.size === 0) {
          return { status: 'error', message: 'All batches failed on first indexing' };
        }
      } else {
        logger.info('No new blobs to upload');
      }

      // 合并已存在和新上传的 blob 名称
      const allBlobNames = [...existingHashes, ...uploadedBlobNames];
      this.saveIndex(allBlobNames);

      const message = `Indexed ${allBlobNames.length} blobs (existing: ${existingHashes.size}, new: ${uploadedBlobNames.length})`;
      logger.info(message);

      return {
        status: failedBatches.length === 0 ? 'success' : 'partial_success',
        message,
        stats: {
          total_blobs: allBlobNames.length,
          existing_blobs: existingHashes.size,
          new_blobs: uploadedBlobNames.length,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to index project: ${errorMessage}`);
      return { status: 'error', message: errorMessage };
    }
  }

  /**
   * 搜索代码上下文（自动增量索引）
   */
  async searchContext(query: string): Promise<string> {
    logger.info(`Searching with query: ${query}`);

    try {
      // 自动索引
      const indexResult = await this.indexProject();
      if (indexResult.status === 'error') {
        return `Error: Failed to index project. ${indexResult.message}`;
      }

      // 加载索引
      const blobNames = this.loadIndex();
      if (blobNames.length === 0) {
        return 'Error: No blobs found after indexing.';
      }

      // 执行搜索
      logger.info(`Searching with ${blobNames.length} blobs...`);
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
        return 'No relevant code context found for your query.';
      }

      logger.info('Search completed');
      return formattedRetrieval;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Search failed: ${errorMessage}`);
      return `Error: ${errorMessage}`;
    }
  }
}
