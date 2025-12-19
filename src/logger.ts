/**
 * 日志模块 - 支持输出到项目 .ace-tool 目录
 */

import fs from 'fs';
import path from 'path';

type LogLevel = 'debug' | 'info' | 'warning' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3
};

// 默认日志级别
let currentLevel: LogLevel = 'info';

// 日志是否启用（默认关闭）
let enabled: boolean = false;

// 日志文件路径
let logFilePath: string | null = null;

// 日志文件流
let logStream: fs.WriteStream | null = null;

function formatTimestamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  // 如果日志未启用，直接返回
  if (!enabled) {
    return;
  }

  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const timestamp = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(7);
  const formattedMessage = args.length > 0
    ? `${message} ${args.map(a => JSON.stringify(a)).join(' ')}`
    : message;

  const logLine = `${timestamp} | ${levelStr} | ${formattedMessage}\n`;

  // 如果有日志文件，写入文件
  if (logStream) {
    logStream.write(logLine);
  }
}

export const logger = {
  /**
   * 启用日志
   */
  enable(): void {
    enabled = true;
  },

  /**
   * 禁用日志
   */
  disable(): void {
    enabled = false;
  },

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    currentLevel = level;
  },

  /**
   * 设置日志输出到项目的 .ace-tool 目录
   * 只有在日志启用时才会创建文件
   */
  setProjectPath(projectRoot: string): void {
    // 如果日志未启用，不创建文件
    if (!enabled) {
      return;
    }

    const aceDir = path.join(projectRoot, '.ace-tool');

    // 确保 .ace-tool 目录存在
    if (!fs.existsSync(aceDir)) {
      fs.mkdirSync(aceDir, { recursive: true });
    }

    logFilePath = path.join(aceDir, 'ace-tool.log');

    // 关闭旧的流
    if (logStream) {
      logStream.end();
    }

    // 创建新的写入流（追加模式）
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

    // 写入分隔线
    const separator = `\n${'='.repeat(60)}\n${formatTimestamp()} | Session started\n${'='.repeat(60)}\n`;
    logStream.write(separator);
  },

  /**
   * 关闭日志流
   */
  close(): void {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
  },

  debug(message: string, ...args: unknown[]): void {
    log('debug', message, ...args);
  },

  info(message: string, ...args: unknown[]): void {
    log('info', message, ...args);
  },

  warning(message: string, ...args: unknown[]): void {
    log('warning', message, ...args);
  },

  error(message: string, ...args: unknown[]): void {
    log('error', message, ...args);
  },

  exception(message: string, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    log('error', `${message}: ${errorMessage}`);
    if (stack && logStream) {
      logStream.write(stack + '\n');
    }
  }
};
