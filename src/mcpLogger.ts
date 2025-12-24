/**
 * 统一日志模块 - 同时支持 MCP 客户端推送和本地文件写入
 */

import fs from 'fs';
import path from 'path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getAceDir } from './utils/projectDetector.js';

type LogLevel = 'debug' | 'info' | 'warning' | 'error';

let mcpServer: Server | null = null;
let fileEnabled: boolean = false;
let logFilePath: string | null = null;
let logStream: fs.WriteStream | null = null;

/**
 * 初始化 MCP 日志模块
 */
export function initMcpLogger(server: Server): void {
  mcpServer = server;
}

/**
 * 启用文件日志
 */
export function enableFileLog(): void {
  fileEnabled = true;
}

/**
 * 设置项目路径（用于文件日志）
 */
export function setLogProjectPath(projectRoot: string): void {
  if (!fileEnabled) {
    return;
  }

  const aceDir = getAceDir(projectRoot);
  logFilePath = path.join(aceDir, 'ace-tool.log');

  // 关闭旧的流
  if (logStream) {
    logStream.end();
  }

  // 创建新的写入流（追加模式）
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  // 写入分隔线
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const separator = `\n${'='.repeat(60)}\n${timestamp} | Session started\n${'='.repeat(60)}\n`;
  logStream.write(separator);
}

/**
 * 关闭日志流
 */
export function closeLog(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

/**
 * 发送日志（同时推送到 MCP 客户端和写入文件）
 */
export function sendMcpLog(level: LogLevel, message: string): void {
  // 1. 推送到 MCP 客户端
  if (mcpServer) {
    mcpServer.sendLoggingMessage({
      level,
      data: message,
    }).catch(() => {
      // 忽略发送失败（可能客户端未连接）
    });
  }

  // 2. 写入本地文件（如果启用）
  if (fileEnabled && logStream) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const levelStr = level.toUpperCase().padEnd(7);
    const logLine = `${timestamp} | ${levelStr} | ${message}\n`;
    logStream.write(logLine);
  }
}
