/**
 * 文件路径纯工具:文件夹=目录模型的基础(桌面端 Windows 为主)。
 * 全部不碰 IO,可安全用于 domain / application / UI 各层。
 *
 * Windows 路径大小写不敏感、分隔符 `/` `\` 通用,因此**比较**一律走
 * normalizePath;**展示与落盘**保留原串。
 */

/** 取父目录;已是根(盘符/空)返回 null */
export function noteDirOf(path: string | undefined | null): string | null {
  if (!path) return null
  const parts = path.split(/[\\/]/)
  parts.pop()
  if (parts.length === 0) return null
  // 'C:' 这种盘符根保留冒号
  return parts.join('\\') || null
}

/** 目录/文件的最后一段(目录名、文件名) */
export function pathBaseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

/** 规范化用于比较:小写 + 分隔符统一 '/' + 去尾分隔符;非字符串入参安全回落 */
export function normalizePath(path: string): string {
  if (!path || typeof path !== 'string') return ''
  return path.replace(/[\\/]+/g, '/').replace(/\/+$/, '').toLowerCase()
}

export function isSamePath(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  return normalizePath(a) === normalizePath(b)
}

/** path 是 dir 本身或位于 dir 之下(目录归属判定,比较不区分大小写/分隔符) */
export function isPathUnder(path: string | undefined | null, dir: string): boolean {
  if (!path) return false
  const p = normalizePath(path)
  const d = normalizePath(dir)
  return p === d || p.startsWith(`${d}/`)
}

/** 文件名净化:替换 Windows 非法字符,去首尾空白与点;空结果回落「未命名」 */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim().replace(/^[.\s]+|[.\s]+$/g, '')
  return cleaned || '未命名'
}

/**
 * path 在 oldDir 目录(含其自身)下时,把前缀换成 newDir;不在下返回 null。
 * 用于目录重命名/移动时批量改绑其下笔记与子文件夹。
 * 原串与规范化串长度一致时按原串切片(保留原大小写/分隔符),否则退回规范化段。
 */
export function swapPathPrefix(path: string, oldDir: string, newDir: string): string | null {
  const p = normalizePath(path)
  const from = normalizePath(oldDir)
  if (p === from) return newDir
  if (!p.startsWith(`${from}/`)) return null
  const restStart = from.length + 1
  const rest = path.length === p.length ? path.slice(restStart) : p.slice(restStart)
  return `${newDir.replace(/[\\/]+$/, '')}\\${rest}`
}
