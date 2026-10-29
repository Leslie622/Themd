import type { Note } from '@/store'

/**
 * 桌面端:原生「另存为」对话框选位置后直接写盘。
 * 返回保存路径;字符串 'canceled'=用户取消;'web'=非 Tauri 环境(调用方回落浏览器下载)。
 */
export async function saveTextViaDialog(
  defaultName: string,
  contents: string,
  filterName: string,
  extensions: string[],
): Promise<string | 'canceled' | 'web'> {
  const { isTauri } = await import('@/lib/theme/font-list')
  if (!isTauri()) return 'web'
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: filterName, extensions }],
  })
  if (!path) return 'canceled'
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('write_text_file', { path, contents })
  return path
}

/** 导出单篇笔记为 .md 文件下载(浏览器端) */
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
 * 桌面端原生文件夹导入:原生目录选择器 + Rust 递归读取,
 * 绕开 WebView2 对 webkitdirectory 的「是否上传 N 个文件」确认弹窗。
 * 返回结构与 readFolder 一致;用户取消返回 null。浏览器端调用返回 null。
 */
export async function readFolderDesktop(): Promise<ImportedFile[] | null> {
  const { isTauri } = await import('@/lib/theme/font-list')
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const dir = await open({ directory: true, multiple: false, title: '选择要导入的文件夹' })
  if (typeof dir !== 'string') return null
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<ImportedFile[]>('read_folder_notes', { root: dir })
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
