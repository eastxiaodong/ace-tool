/**
 * search_context 工具实现
 */

import fs from 'fs';
import { getConfig } from '../config.js';
import { IndexManager } from '../index/manager.js';
import { logger } from '../logger.js';

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

    // 根据配置启用日志
    if (config.enableLog) {
      logger.enable();
      logger.setProjectPath(projectRoot);
    }
    logger.info(`Tool invoked: search_context for project ${projectRoot}`);
    const indexManager = new IndexManager(
      projectRoot,
      config.baseUrl,
      config.token,
      config.textExtensions,
      config.batchSize,
      config.maxLinesPerBlob,
      config.excludePatterns
    );

    const result = await indexManager.searchContext(query);

    return { type: 'text', text: result };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.exception('Error in search_context_tool', error);
    return { type: 'text', text: `Error: ${errorMessage}` };
  }
}
