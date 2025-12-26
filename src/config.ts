/**
 * 配置模块 - 从命令行参数读取配置
 */

export interface Config {
  baseUrl: string;
  token: string;
  batchSize: number;
  maxLinesPerBlob: number;
  textExtensions: Set<string>;
  excludePatterns: string[];
  enableLog: boolean;
}

/**
 * 上传策略配置（根据项目规模自适应）
 */
export interface UploadStrategy {
  batchSize: number;      // 每批上传的文件块数
  concurrency: number;    // 并发上传数
  timeout: number;        // 单次请求超时（毫秒）
  scaleName: string;      // 规模名称（用于日志）
}

/**
 * 根据文件块数量获取自适应上传策略
 */
export function getUploadStrategy(blobCount: number): UploadStrategy {
  if (blobCount < 100) {
    // 小型项目：保守配置，快速完成
    return {
      batchSize: 10,
      concurrency: 1,
      timeout: 30000,
      scaleName: '小型'
    };
  } else if (blobCount < 500) {
    // 中型项目：适度并发
    return {
      batchSize: 30,
      concurrency: 2,
      timeout: 45000,
      scaleName: '中型'
    };
  } else if (blobCount < 2000) {
    // 大型项目：高效并发
    return {
      batchSize: 50,
      concurrency: 3,
      timeout: 60000,
      scaleName: '大型'
    };
  } else {
    // 超大型项目：最大化吞吐
    return {
      batchSize: 70,
      concurrency: 4,
      timeout: 90000,
      scaleName: '超大型'
    };
  }
}

// 默认支持的文本文件扩展名
const DEFAULT_TEXT_EXTENSIONS = new Set([
  // 主流编程语言
  '.py', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.java', '.go', '.rs', '.cpp', '.c', '.cc',
  '.h', '.hpp', '.hxx', '.cs', '.rb', '.php',
  '.swift', '.kt', '.kts', '.scala', '.clj', '.cljs',
  // 其他编程语言
  '.lua', '.dart', '.m', '.mm', '.pl', '.pm',
  '.r', '.R', '.jl', '.ex', '.exs', '.erl',
  '.hs', '.zig', '.v', '.nim', '.f90', '.f95',
  '.groovy', '.gradle', '.sol', '.move',
  // 配置和数据
  '.md', '.mdx', '.txt', '.json', '.jsonc', '.json5',
  '.yaml', '.yml', '.toml', '.xml', '.ini', '.conf',
  '.cfg', '.properties', '.env.example', '.editorconfig',
  // Web 相关
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl',
  '.vue', '.svelte', '.astro',
  // 模板引擎
  '.ejs', '.hbs', '.pug', '.jade', '.jinja', '.jinja2',
  '.erb', '.liquid', '.twig', '.mustache', '.njk',
  // 脚本和构建
  '.sql', '.sh', '.bash', '.zsh', '.fish',
  '.ps1', '.psm1', '.bat', '.cmd',
  '.makefile', '.mk', '.cmake',
  // API 和数据格式
  '.graphql', '.gql', '.proto', '.prisma',
  '.csv', '.tsv',
  // 文档
  '.rst', '.adoc', '.tex', '.org',
  // Docker 和 CI/CD
  '.dockerfile', '.containerfile',
  // 其他
  '.vim', '.el', '.rkt'
]);

// 默认排除模式
const DEFAULT_EXCLUDE_PATTERNS = [
  // 虚拟环境和依赖
  '.venv', 'venv', '.env', 'env', 'node_modules',
  'vendor', '.pnpm', '.yarn', 'bower_components',
  // 版本控制
  '.git', '.svn', '.hg', '.gitmodules',
  // Python 缓存
  '__pycache__', '.pytest_cache', '.mypy_cache',
  '.tox', '.eggs', '*.egg-info', '.ruff_cache',
  // 构建产物
  'dist', 'build', 'target', 'out', 'bin', 'obj',
  '.next', '.nuxt', '.output', '.vercel', '.netlify',
  '.turbo', '.parcel-cache', '.cache', '.temp', '.tmp',
  // 测试覆盖率
  'coverage', '.nyc_output', 'htmlcov',
  // IDE 配置
  '.idea', '.vscode', '.vs', '*.swp', '*.swo',
  // 系统文件
  '.DS_Store', 'Thumbs.db', 'desktop.ini',
  // 编译和二进制文件
  '*.pyc', '*.pyo', '*.pyd', '*.so', '*.dll', '*.dylib',
  '*.exe', '*.o', '*.obj', '*.class', '*.jar', '*.war',
  // 压缩和打包文件
  '*.min.js', '*.min.css', '*.bundle.js', '*.chunk.js',
  '*.map', '*.gz', '*.zip', '*.tar', '*.rar',
  // 锁文件（通常不需要索引）
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Gemfile.lock', 'poetry.lock', 'Cargo.lock', 'composer.lock',
  // 日志和临时文件
  '*.log', 'logs', 'tmp', 'temp',
  // 媒体文件
  '*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico', '*.svg',
  '*.mp3', '*.mp4', '*.wav', '*.avi', '*.mov',
  '*.pdf', '*.doc', '*.docx', '*.xls', '*.xlsx',
  // 字体文件
  '*.woff', '*.woff2', '*.ttf', '*.eot', '*.otf',
  // 数据库文件
  '*.db', '*.sqlite', '*.sqlite3',
  // Ace-tool 目录
  '.ace-tool'
];

let config: Config | null = null;

/**
 * 解析命令行参数
 */
function parseArgs(): { baseUrl?: string; token?: string; enableLog?: boolean } {
  const args = process.argv.slice(2);
  const result: { baseUrl?: string; token?: string; enableLog?: boolean } = {};

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

  // 确保 baseUrl 使用 https:// 协议
  let baseUrl = args.baseUrl;
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  } else if (baseUrl.startsWith('http://')) {
    // ACE 服务器只支持 HTTPS，自动转换
    const originalUrl = baseUrl;
    baseUrl = baseUrl.replace('http://', 'https://');
    console.log(`🔐 已自动将 http:// 转换为 https:// (${originalUrl} → ${baseUrl})`);
  }

  baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠

  config = {
    baseUrl,
    token: args.token,
    batchSize: 10,
    maxLinesPerBlob: 800,
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
