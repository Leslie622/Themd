import type { Note } from '@/store'

/** 导出单篇笔记为 .md 文件下载 */
export function downloadNote(note: Note): void {
  const blob = new Blob([note.content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${note.title || 'note'}.md`
  a.click()
  URL.revokeObjectURL(url)
}

/** 读取文件选择器里的所有 .md 文件 */
export async function readFiles(
  fileList: FileList,
): Promise<{ title: string; content: string }[]> {
  return Promise.all(
    Array.from(fileList).map(async (file) => ({
      title: file.name.replace(/\.(md|markdown|txt)$/i, ''),
      content: await file.text(),
    })),
  )
}

export interface ImportedFile {
  /** 相对目录路径(如 docs/notes);顶层为空串 */
  folderPath: string
  title: string
  content: string
}

/**
 * 读取文件夹选择器(webkitdirectory)里的所有 .md 文件。
 * webkitRelativePath 形如 rootName/sub/file.md → folderPath = rootName/sub。
 */
export async function readFolder(
  fileList: FileList,
): Promise<ImportedFile[]> {
  const mdFiles = Array.from(fileList).filter((f) =>
    /\.(md|markdown|txt)$/i.test(f.name),
  )
  return Promise.all(
    mdFiles.map(async (file) => {
      const rel =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? ''
      const parts = rel.split('/')
      parts.pop() // 去掉文件名
      return {
        folderPath: parts.join('/'),
        title: file.name.replace(/\.(md|markdown|txt)$/i, ''),
        content: await file.text(),
      }
    }),
  )
}
