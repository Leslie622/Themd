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
