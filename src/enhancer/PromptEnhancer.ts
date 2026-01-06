/**
 * Prompt Enhancer - 核心增强逻辑
 * 基于 Augment VSCode 插件的实现
 */

import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import { exec } from 'child_process';
import { IndexManager } from '../index/manager.js';
import { EnhancerServer } from './EnhancerServer.js';
import { sendMcpLog } from '../mcpLogger.js';

/**
 * Prompt Enhancer 类
 */
export class PromptEnhancer {
  private httpClient: AxiosInstance;
  private server: EnhancerServer;

  constructor(
    private indexManager: IndexManager,
    private baseUrl: string,
    private token: string,
    server: EnhancerServer
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.server = server;

    this.httpClient = axios.create({
      timeout: 60000,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * 增强 prompt
   * @param originalPrompt 原始用户输入
   * @param conversationHistory 对话历史（5-10轮）
   * @returns 增强后的 prompt
   */
  async enhance(originalPrompt: string, conversationHistory: string): Promise<string> {
    sendMcpLog('info', '🎨 开始增强 prompt...');

    try {
      // 1. 加载已索引的 blob 列表
      sendMcpLog('info', '📂 加载索引数据...');
      const blobNames = this.loadBlobNames();

      if (blobNames.length === 0) {
        sendMcpLog('warning', '⚠️ 未找到索引数据，将在没有代码上下文的情况下增强');
      } else {
        sendMcpLog('info', `📊 已加载 ${blobNames.length} 个文件块`);
      }

      // 2. 设置增强回调函数（用于"继续增强"功能）
      this.server.setEnhanceCallback(async (prompt, history, blobs) => {
        return await this.callPromptEnhancerApi(prompt, history, blobs);
      });

      // 3. 调用 prompt-enhancer API 生成增强内容
      sendMcpLog('info', '🤖 调用 prompt-enhancer API 生成增强内容...');
      const enhancedPrompt = await this.callPromptEnhancerApi(
        originalPrompt,
        conversationHistory,
        blobNames
      );
      sendMcpLog('info', '✅ 增强内容生成成功');

      // 4. 启动 Web UI 交互
      sendMcpLog('info', '🌐 启动 Web UI 等待用户确认...');
      const finalPrompt = await this.interactWithUser(
        enhancedPrompt,
        originalPrompt,
        conversationHistory,
        blobNames
      );

      sendMcpLog('info', '✅ Prompt 增强完成');
      return finalPrompt;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendMcpLog('error', `❌ Prompt 增强失败: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 加载已索引的 blob 名称列表
   */
  private loadBlobNames(): string[] {
    try {
      // 使用 IndexManager 的私有��法需要通过反射或者添加公共方法
      // 这里我们直接读取索引文件
      const indexFilePath = (this.indexManager as any).indexFilePath;

      if (!fs.existsSync(indexFilePath)) {
        return [];
      }

      const content = fs.readFileSync(indexFilePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      sendMcpLog('warning', `⚠️ 加载索引失败: ${error}`);
      return [];
    }
  }

  /**
   * 调用 prompt-enhancer API 生成增强内容
   */
  private async callPromptEnhancerApi(
    originalPrompt: string,
    conversationHistory: string,
    blobNames: string[]
  ): Promise<string> {
    // 解析对话历史
    const chatHistory = this.parseChatHistory(conversationHistory);

    // 检测原始 prompt 的语言
    const isChinese = /[\u4e00-\u9fa5]/.test(originalPrompt);
    const languageGuideline = isChinese
      ? 'Please respond in Chinese (Simplified Chinese). 请用中文回复。'
      : '';

    // 构造符合 Augment 格式的 payload
    // nodes 包含用户的原始 prompt
    const payload = {
      nodes: [
        {
          id: 1,
          type: 0, // text node type
          text_node: {
            content: originalPrompt
          }
        }
      ],
      chat_history: chatHistory,
      blobs: {
        checkpoint_id: null,
        added_blobs: blobNames,
        deleted_blobs: [],
      },
      conversation_id: null,
      model: 'claude-sonnet-4-5',
      mode: 'CHAT',
      user_guided_blobs: [],
      external_source_ids: [],
      user_guidelines: languageGuideline,
      workspace_guidelines: '',
      rules: []
    };

    try {
      const response = await this.httpClient.post(
        `${this.baseUrl}/prompt-enhancer`,
        payload
      );

      let enhancedText = response.data.text || '';

      if (!enhancedText) {
        throw new Error('Prompt enhancer API 返回空结果');
      }

      // 替换 Augment 特定的工具名称为 ace-tool 的工具名称
      enhancedText = this.replaceToolNames(enhancedText);

      return enhancedText;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Token 已失效或无效，请检查配置');
      } else if (error.response?.status === 403) {
        throw new Error('访问被拒绝，Token 可能已被禁用');
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('无法连接到服务器，请检查 base-url 配置');
      }

      throw new Error(`Prompt enhancer API 调用失败: ${error.message}`);
    }
  }

  /**
   * 替换 Augment 特定的工具名称为 ace-tool 的工具名称
   */
  private replaceToolNames(text: string): string {
    // 替换 codebase-retrieval 为 search_context
    // 支持多种可能的格式：
    // 1. 工具调用格式：codebase-retrieval 或 codebase_retrieval
    // 2. 文本引用格式：`codebase-retrieval` 或 "codebase-retrieval"

    let result = text;

    // 替换各种格式的 codebase-retrieval
    result = result.replace(/codebase-retrieval/g, 'search_context');
    result = result.replace(/codebase_retrieval/g, 'search_context');

    // 如果有其他 Augment 特定的工具需要替换，可以在这里添加

    return result;
  }

  /**
   * 解析对话历史为 chat_history 格式
   */
  private parseChatHistory(conversationHistory: string): Array<{role: string, content: string}> {
    // 简单解析对话历史
    // 格式示例: "User: xxx\nAI: yyy\nUser: zzz"
    const lines = conversationHistory.split('\n');
    const chatHistory: Array<{role: string, content: string}> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('User:') || trimmed.startsWith('用户:')) {
        chatHistory.push({
          role: 'user',
          content: trimmed.replace(/^(User:|用户:)\s*/, '')
        });
      } else if (trimmed.startsWith('AI:') || trimmed.startsWith('Assistant:') || trimmed.startsWith('助手:')) {
        chatHistory.push({
          role: 'assistant',
          content: trimmed.replace(/^(AI:|Assistant:|助手:)\s*/, '')
        });
      }
    }

    return chatHistory;
  }

  /**
   * 通过 Web UI 与用户交互
   */
  private async interactWithUser(
    enhancedPrompt: string,
    originalPrompt: string,
    conversationHistory: string,
    blobNames: string[]
  ): Promise<string> {
    // 确保服务器已启动
    await this.server.start();

    // 创建 session（传入所有必要的参数以支持"继续增强"）
    const sessionId = this.server.createSession(
      enhancedPrompt,
      originalPrompt,
      conversationHistory,
      blobNames
    );

    // 打开浏览器
    const url = `http://localhost:${this.server.getPort()}/enhance?session=${sessionId}`;
    sendMcpLog('info', `🌐 请在浏览器中查看: ${url}`);

    // 尝试自动打开浏览器
    this.openBrowser(url);

    // 等待用户操作
    try {
      const finalPrompt = await this.server.waitForSession(sessionId);

      if (!finalPrompt || finalPrompt.trim() === '') {
        sendMcpLog('info', '❌ 用户取消了增强');
        throw new Error('User cancelled the enhancement');
      }

      return finalPrompt;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        sendMcpLog('error', '⏱️ 用户交互超时（8分钟）');
        throw new Error('User interaction timeout (8 minutes)');
      }
      throw error;
    }
  }

  /**
   * 打开浏览器
   */
  private openBrowser(url: string): void {
    const platform = process.platform;

    let command: string;
    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      // Windows 的 start 命令：第一个引号参数是窗口标题，第二个才是 URL
      command = `start "ACE-TOOL" "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    exec(command, (error: any) => {
      if (error) {
        sendMcpLog('warning', `⚠️ 无法自动打开浏览器: ${error.message}`);
        sendMcpLog('info', `请手动打开: ${url}`);
      }
    });
  }
}
