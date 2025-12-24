/**
 * 项目根目录检测工具
 * 从当前工作目录向上查找 .git/ 目录
 */
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * 检测项目根目录
 * 优先级：.git/
 *
 * @returns 项目根目录路径
 * @throws 如果找不到项目根目录
 */
export function detectProjectRoot(): string {
  const cwd = process.cwd();
  let currentDir = cwd;

  while (true) {
    // 检查 .git 目录
    const gitPath = path.join(currentDir, '.git');
    if (fs.existsSync(gitPath)) {
      return currentDir;
    }

    // 向上一级目录
    const parentDir = path.dirname(currentDir);

    // 已到达根目录
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  // 如果找不到 .git，使用当前工作目录
  return cwd;
}

/**
 * 获取用户主目录的 .ace-tool 基础目录
 */
function getAceBaseDir(): string {
  return path.join(os.homedir(), '.ace-tool');
}

/**
 * 规范化存储目录名，避免非法字符
 */
function sanitizeSegment(name: string): string {
  const sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  return sanitized === '' ? 'unknown' : sanitized;
}

function hashPath(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 8);
}

function flattenPathSegments(resolvedRoot: string): string {
  const parsed = path.parse(resolvedRoot);
  const isWindowsDrive = /^[a-zA-Z]:[\\/]*$/.test(parsed.root);
  const drivePrefix = isWindowsDrive ? sanitizeSegment(parsed.root.replace(/[:\\/]+/g, '')) : '';
  const parts = resolvedRoot.split(/[\\/]+/).filter((part) => part.length > 0);
  if (isWindowsDrive && parts.length > 0 && parts[0].includes(':')) {
    parts.shift();
  }
  const safeParts = parts.map((part) => sanitizeSegment(part));
  const withDrive = drivePrefix ? [drivePrefix, ...safeParts] : safeParts;
  const flattened = withDrive.filter((part) => part.length > 0).join('-');
  return flattened === '' ? 'unknown' : flattened;
}

/**
 * 获取项目的 .ace-tool 目录路径（用户主目录下）
 * 如果不存在则创建
 *
 * @param projectRoot 项目根目录
 * @returns .ace-tool 目录路径
 */
export function getAceDir(projectRoot: string): string {
  const resolvedRoot = path.resolve(projectRoot);
  const flatPath = flattenPathSegments(resolvedRoot);
  const projectHash = hashPath(resolvedRoot);
  const aceDir = path.join(getAceBaseDir(), `${flatPath}-${projectHash}`);

  if (!fs.existsSync(aceDir)) {
    fs.mkdirSync(aceDir, { recursive: true });
  }

  return aceDir;
}

/**
 * 获取索引文件路径
 *
 * @param projectRoot 项目根目录
 * @returns index.json 文件路径
 */
export function getIndexFilePath(projectRoot: string): string {
  const aceDir = getAceDir(projectRoot);
  return path.join(aceDir, 'index.json');
}

/**
 * 规范化路径，统一使用正斜杠
 */
export function normalizePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/');
}
