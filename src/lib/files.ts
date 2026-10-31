import { platformServices } from '@/app/platform'

export interface ImportedFile {
  /** 相对目录路径(如 docs/notes);顶层为空串 */
  folderPath: string
  title: string
  content: string
  /** 来源文件绝对路径;笔记据此绑定源文件双向同步 */
  filePath?: string
}

/**
 * 原生文件夹导入:原生目录选择器 + Rust 递归读取
 * read_folder_notes(绕开 WebView2 对 webkitdirectory 的确认弹窗)。
 * 用户取消返回 null。
 */
export async function readFolderDesktop(): Promise<ImportedFile[] | null> {
  return platformServices.files.pickFolder()
}
