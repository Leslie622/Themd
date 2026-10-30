export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
  titleCustom?: boolean
  themeId?: string
  folderId?: string
}

export interface Folder {
  id: string
  name: string
  order: number
}

export interface NotebookSnapshot {
  schemaVersion: 1
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

export const NOTEBOOK_SCHEMA_VERSION = 1 as const
