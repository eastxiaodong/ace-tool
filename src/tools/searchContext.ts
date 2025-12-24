/**
 * search_context 工具实现
 */

import fs from 'fs';
import { getConfig } from '../config.js';
import { IndexManager } from '../index/manager.js';
import { enableFileLog, setLogProjectPath, sendMcpLog } from '../mcpLogger.js';

/**
 * 工具参数接口
 */
interface SearchContextArgs {
  project_root_path?: string;
  query?: string;
}

/**
 * 工具结果接口
 */
interface ToolResult {
  type: string;
  text: string;
}

/**
 * search_context 工具实现
 */
export async function searchContextTool(args: SearchContextArgs): Promise<ToolResult> {
  try {
    const query = args.query;
    const projectRootPath = args.project_root_path;

    if (!query) {
      return { type: 'text', text: 'Error: query is required' };
    }

    if (!projectRootPath) {
      return { type: 'text', text: 'Error: project_root_path is required' };
    }

    // 规范化路径（统一使用正斜杠）
    const projectRoot = projectRootPath.replace(/\\/g, '/');

    // 验证路径是否存在
    if (!fs.existsSync(projectRoot)) {
      return { type: 'text', text: `Error: Project path does not exist: ${projectRoot}` };
    }

    // 验证是否为目录
    const stats = fs.statSync(projectRoot);
    if (!stats.isDirectory()) {
      return { type: 'text', text: `Error: Project path is not a directory: ${projectRoot}` };
    }

    const config = getConfig();

    // 根据配置启用文件日志
    if (config.enableLog) {
      enableFileLog();
      setLogProjectPath(projectRoot);
    }

    const indexManager = new IndexManager(
      projectRoot,
      config.baseUrl,
      config.token,
      config.textExtensions,
      config.batchSize,
      config.maxLinesPerBlob,
      config.excludePatterns,
      config.uploadConcurrency,
      config.uploadTimeoutMs,
      config.retrievalTimeoutMs
    );

    const result = await indexManager.searchContext(query);

    return { type: 'text', text: result };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendMcpLog('error', `❌ 工具执行错误: ${errorMessage}`);
    return { type: 'text', text: `Error: ${errorMessage}` };
  }
}
