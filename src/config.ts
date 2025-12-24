/**
 * 配置模块 - 从命令行参数读取配置
 */

export interface Config {
  baseUrl: string;
  token: string;
  batchSize: number;
  maxLinesPerBlob: number;
  uploadConcurrency: number;
  uploadTimeoutMs: number;
  retrievalTimeoutMs: number;
  textExtensions: Set<string>;
  excludePatterns: string[];
  enableLog: boolean;
}

// 默认支持的文本文件扩展名
const DEFAULT_TEXT_EXTENSIONS = new Set([
  // 编程语言
  '.py', '.js', '.ts', '.jsx', '.tsx',
  '.java', '.go', '.rs', '.cpp', '.c',
  '.h', '.hpp', '.cs', '.rb', '.php',
  '.swift', '.kt', '.scala', '.clj',
  // 配置和数据
  '.md', '.txt', '.json', '.yaml', '.yml',
  '.toml', '.xml', '.ini', '.conf',
  // Web 相关
  '.html', '.css', '.scss', '.sass', '.less',
  // 脚本
  '.sql', '.sh', '.bash', '.ps1', '.bat',
  '.vue', '.svelte'
]);

// 默认排除模式
const DEFAULT_EXCLUDE_PATTERNS = [
  // 虚拟环境
  '.venv', 'venv', '.env', 'env', 'node_modules',
  // 版本控制
  '.git', '.svn', '.hg',
  // Python 缓存
  '__pycache__', '.pytest_cache', '.mypy_cache',
  '.tox', '.eggs', '*.egg-info',
  // 构建产物
  'dist', 'build', 'target', 'out',
  // IDE 配置
  '.idea', '.vscode', '.vs',
  // 系统文件
  '.DS_Store', 'Thumbs.db',
  // 编译文件
  '*.pyc', '*.pyo', '*.pyd', '*.so', '*.dll',
  // Ace-tool 目录
  '.ace-tool'
];

let config: Config | null = null;

/**
 * 解析命令行参数
 */
function parseArgs(): {
  baseUrl?: string;
  token?: string;
  enableLog?: boolean;
  batchSize?: number;
  maxLinesPerBlob?: number;
  uploadConcurrency?: number;
  uploadTimeoutMs?: number;
  retrievalTimeoutMs?: number;
} {
  const args = process.argv.slice(2);
  const result: {
    baseUrl?: string;
    token?: string;
    enableLog?: boolean;
    batchSize?: number;
    maxLinesPerBlob?: number;
    uploadConcurrency?: number;
    uploadTimeoutMs?: number;
    retrievalTimeoutMs?: number;
  } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--base-url' && i + 1 < args.length) {
      result.baseUrl = args[i + 1];
      i++;
    } else if (arg === '--token' && i + 1 < args.length) {
      result.token = args[i + 1];
      i++;
    } else if (arg === '--enable-log') {
      result.enableLog = true;
    } else if (arg === '--batch-size' && i + 1 < args.length) {
      result.batchSize = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--max-lines-per-blob' && i + 1 < args.length) {
      result.maxLinesPerBlob = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--upload-concurrency' && i + 1 < args.length) {
      result.uploadConcurrency = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--upload-timeout-ms' && i + 1 < args.length) {
      result.uploadTimeoutMs = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (arg === '--retrieval-timeout-ms' && i + 1 < args.length) {
      result.retrievalTimeoutMs = Number.parseInt(args[i + 1], 10);
      i++;
    }
  }

  return result;
}

/**
 * 初始化配置
 */
export function initConfig(): Config {
  const args = parseArgs();

  if (!args.baseUrl) {
    throw new Error('Missing required argument: --base-url');
  }

  if (!args.token) {
    throw new Error('Missing required argument: --token');
  }

  // 确保 baseUrl 包含协议前缀
  let baseUrl = args.baseUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠

  config = {
    baseUrl,
    token: args.token,
    batchSize: Number.isFinite(args.batchSize) && (args.batchSize as number) > 0 ? (args.batchSize as number) : 50,
    maxLinesPerBlob:
      Number.isFinite(args.maxLinesPerBlob) && (args.maxLinesPerBlob as number) > 0
        ? (args.maxLinesPerBlob as number)
        : 2000,
    uploadConcurrency:
      Number.isFinite(args.uploadConcurrency) && (args.uploadConcurrency as number) > 0
        ? (args.uploadConcurrency as number)
        : 2,
    uploadTimeoutMs:
      Number.isFinite(args.uploadTimeoutMs) && (args.uploadTimeoutMs as number) > 0
        ? (args.uploadTimeoutMs as number)
        : 30000,
    retrievalTimeoutMs:
      Number.isFinite(args.retrievalTimeoutMs) && (args.retrievalTimeoutMs as number) > 0
        ? (args.retrievalTimeoutMs as number)
        : 60000,
    textExtensions: DEFAULT_TEXT_EXTENSIONS,
    excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
    enableLog: args.enableLog || false
  };

  return config;
}

/**
 * 获取配置
 */
export function getConfig(): Config {
  if (!config) {
    throw new Error('Config not initialized. Call initConfig() first.');
  }
  return config;
}
