export interface Note {
  id: string
  /** 标题恒等于磁盘文件名主干(树=磁盘,双向同步的唯一事实在磁盘) */
  title: string
  content: string
  updatedAt: number
  themeId?: string
  /** 磁盘文件绝对路径(folder-first:每个笔记都是工作区内的文件) */
  sourcePath: string
}

/**
 * 文件夹 = 磁盘目录:`path` 是绝对目录路径,层级由路径前缀派生,
 * 不存 parentId。绑定笔记归属「其所在目录」的文件夹,由控制器惰性补建
 * (不变式:每个绑定笔记的目录都有 Folder 实体)。
 */
export interface Folder {
  id: string
  /** 目录 basename,显示用 */
  name: string
  /** 绝对目录路径,文件夹的唯一事实 */
  path: string
  order: number
}

export interface NotebookSnapshot {
  schemaVersion: 4
  notes: Note[]
  folders: Folder[]
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

export const NOTEBOOK_SCHEMA_VERSION = 4 as const

/**
 * 从绝对/相对路径取文件名主干(去扩展名),外部重命名文件时用作新标题。
 * 兼容两种分隔符,Windows 路径不受 `/` 误伤(盘符 `C:` 不含 `/`)。
 */
export function fileNameStem(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? ''
  return name.replace(/\.(md|markdown|txt)$/i, '')
}
