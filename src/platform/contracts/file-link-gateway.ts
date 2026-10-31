/**
 * 文件绑定网关:绑定笔记与磁盘文件之间的双向同步能力(仅桌面端有真实实现)。
 *
 * - `writeTextFile` 原子写(临时文件 + 替换),编辑防抖后写回原文件
 * - `watchPaths` 全量替换监听集合,Rust 侧按父目录分组监听外部改动
 * - `onFsChanges` 订阅外部文件系统事件(modified/removed/renamed)
 *
 * Web 端浏览器沙箱无本地文件能力,实现为 no-op stub,库内笔记模式不受影响。
 */

export type FsChangeEvent =
  | { kind: 'modified'; path: string }
  | { kind: 'removed'; path: string }
  | { kind: 'renamed'; oldPath: string; newPath: string }

export interface FileLinkGateway {
  /** 读取磁盘文件文本(外部改动后重载用);失败抛错 */
  readTextFile(path: string): Promise<string>
  /** 原子写文本文件到指定绝对路径(绑定写回);失败抛错 */
  writeTextFile(path: string, contents: string): Promise<void>
  /** 全量替换监听集合(按父目录分组);空数组 = 停止监听 */
  watchPaths(paths: string[]): Promise<void>
  /** 订阅文件系统事件(已防抖归并);Tauri 的 listen 是异步的,返回退订 Promise */
  onFsChanges(listener: (events: FsChangeEvent[]) => void): Promise<() => void>
}
