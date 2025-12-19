#!/usr/bin/env node

/**
 * Ace Tool - MCP 服务器入口
 * 代码库索引和语义搜索工具
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { initConfig } from './config.js';
import { logger } from './logger.js';
import { SEARCH_CONTEXT_TOOL } from './prompts/searchContext.js';
import { searchContextTool } from './tools/searchContext.js';

/**
 * 创建 MCP 服务器
 */
const server = new Server(
  {
    name: 'ace-tool',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * 列出可用工具
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [
    {
      name: SEARCH_CONTEXT_TOOL.name,
      description: SEARCH_CONTEXT_TOOL.description,
      inputSchema: SEARCH_CONTEXT_TOOL.inputSchema,
    },
  ];

  return { tools };
});

/**
 * 处理工具调用
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logger.info(`Tool called: ${name}, args: ${JSON.stringify(args)}`);

  try {
    if (name === 'search_context') {
      const result = await searchContextTool(args as { project_root_path?: string; query?: string });
      logger.info(`Tool result: ${result?.text?.substring(0, 100)}...`);
      return {
        content: [
          {
            type: 'text',
            text: result?.text || 'Error: No result returned',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${name}`,
        },
      ],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Tool execution error: ${errorMessage}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
    };
  }
});

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    // 初始化配置
    const config = initConfig();

    logger.info('Starting ace-tool MCP server...');
    logger.info(`API: ${config.baseUrl}`);

    // 启动 MCP 服务器
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP server connected via stdio');
  } catch (error: unknown) {
    logger.exception('Server error', error);
    process.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
