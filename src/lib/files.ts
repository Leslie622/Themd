import type { Note } from '@/store'
import { platformServices } from '@/app/platform'

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
  const result = await platformServices.files.saveText({
    defaultName,
    contents,
    filterName,
    extensions,
  })
  if (result.kind === 'web') return 'web'
  if (result.kind === 'canceled') return 'canceled'
  return result.path
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

/** 读取文件选择器里的所有 .md 文件(浏览器端拿不到绝对路径,不绑定) */
export async function readFiles(
  fileList: FileList,
): Promise<ImportedFile[]> {
  return Promise.all(
    Array.from(fileList).map(async (file) => ({
      folderPath: '',
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
  /** 来源文件绝对路径(仅桌面端原生导入有值);笔记据此绑定源文件双向同步 */
  filePath?: string
}

/**
 * 桌面端原生文件夹导入:原生目录选择器 + Rust 递归读取,
 * 绕开 WebView2 对 webkitdirectory 的「是否上传 N 个文件」确认弹窗。
 * 返回结构与 readFolder 一致;用户取消返回 null。浏览器端调用返回 null。
 */
export async function readFolderDesktop(): Promise<ImportedFile[] | null> {
  if (!platformServices.isDesktop) return null
  return platformServices.files.pickFolder()
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
