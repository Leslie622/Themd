export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
  titleCustom?: boolean
  themeId?: string
  folderId?: string
  /** 绑定的磁盘文件绝对路径;无此字段 = 纯库内笔记(Web 端全部如此) */
  sourcePath?: string
}

export interface Folder {
  id: string
  name: string
  order: number
}

export interface NotebookSnapshot {
  schemaVersion: 2
  notes: Note[]
  folders: Folder[]
}

export function deriveTitle(content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)
  if (heading) return heading[1].trim().slice(0, 50)
  const line = content
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith('#') && !item.startsWith('!['))
  return line ? line.replace(/^[#>*`\-\s]+/, '').slice(0, 50) : ''
}

/**
 * 正文字数:剔除内嵌 data URL(base64 图片动辄几十万字符,不应计入字数)。
 * 只剥离 `](data:…)` 的 URL 段,alt 文本等正文保留;其他 markdown 语法
 * 字符本就占比极小,不做语法树级别的精确剥离。
 */
export function countWords(content: string): number {
  const withoutDataUrls = content.replace(/\]\(data:[^)]*\)/g, ']()')
  // surrogate pair(emoji 等)按 1 计:[...str] 按码点展开
  return [...withoutDataUrls].length
}

/** 正文图片数:按 markdown 图片语法 `![alt](url)` 计,内嵌 base64 与外链一视同仁。 */
export function countImages(content: string): number {
  return content.match(/!\[[^\]]*\]\([^)]*\)/g)?.length ?? 0
}

export const NOTEBOOK_SCHEMA_VERSION = 2 as const

/**
 * 从绝对/相对路径取文件名主干(去扩展名),外部重命名文件时用作新标题。
 * 兼容两种分隔符,Windows 路径不受 `/` 误伤(盘符 `C:` 不含 `/`)。
 */
export function fileNameStem(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? ''
  return name.replace(/\.(md|markdown|txt)$/i, '')
}
