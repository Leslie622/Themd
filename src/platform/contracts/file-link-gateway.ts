/**
 * 文件绑定网关:绑定笔记与磁盘文件之间的双向同步能力。
 *
 * - `writeTextFile` 原子写(临时文件 + 替换),编辑防抖后写回原文件
 * - `readFolderNotes` 递归读取目录笔记文件(打开工作区用)
 * - `watchWorkspace` 对工作区根建递归监听(Rust notify),null = 停止
 * - `onFsChanges` 订阅外部文件系统事件(modified/removed/renamed)
 */
import type { ImportedFile } from './file-gateway'

export type FsChangeEvent =
  | { kind: 'modified'; path: string }
  | { kind: 'removed'; path: string }
  | { kind: 'renamed'; oldPath: string; newPath: string }

export interface FileLinkGateway {
  /** 读取磁盘文件文本(外部改动后重载用);失败抛错 */
  readTextFile(path: string): Promise<string>
  /** 递归读取目录下全部笔记文件(.md/.markdown/.txt,非 UTF-8 无 filePath);失败抛错 */
  readFolderNotes(root: string): Promise<ImportedFile[]>
  /** 原子写文本文件到指定绝对路径(绑定写回);失败抛错 */
  writeTextFile(path: string, contents: string): Promise<void>
  /** 监听工作区根(递归,整棵目录树实时);null = 停止监听 */
  watchWorkspace(root: string | null): Promise<void>
  /** 订阅文件系统事件(已防抖归并);Tauri 的 listen 是异步的,返回退订 Promise */
  onFsChanges(listener: (events: FsChangeEvent[]) => void): Promise<() => void>
  /** 移动文件到目标目录(重名自动加后缀);返回实际落点绝对路径;失败抛错 */
  moveFile(src: string, destDir: string): Promise<string>
  /** 同目录内重命名文件(笔记重命名 = 磁盘文件改名);重名自动加后缀,返回实际落点;失败抛错 */
  renameFile(src: string, newName: string): Promise<string>
  /** 重命名目录(仅同盘);组内笔记路径由调用方批量改绑;失败抛错 */
  renameDirectory(oldPath: string, newPath: string): Promise<void>
  /** 删除文件(移入系统回收站,可恢复);失败抛错 */
  trashFile(path: string): Promise<void>
  /** 删除目录(整棵移入系统回收站,可恢复);失败抛错 */
  deleteDirectory(path: string): Promise<void>
  /** 目标目录下求无冲突的文件路径(过滤非法字符 + 重名自动后缀) */
  uniqueDestination(dir: string, fileName: string): Promise<string>
}
