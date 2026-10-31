export interface ImportedFile { folderPath: string; title: string; content: string; /** 来源文件绝对路径;笔记据此绑定源文件双向同步 */ filePath?: string }
export interface SaveTextInput { defaultName: string; contents: string; filterName: string; extensions: string[] }
export interface SavePathInput { defaultName: string; filterName: string; extensions: string[] }
export type SaveResult = { kind: 'canceled' } | { kind: 'saved'; path: string }
export interface FileGateway {
  pickFiles(): Promise<ImportedFile[]>
  pickFolder(): Promise<ImportedFile[] | null>
  chooseSavePath(input: SavePathInput): Promise<string | null>
  saveText(input: SaveTextInput): Promise<SaveResult>
  /** 选择目录返回绝对路径(本地图片根目录);取消返回 null */
  pickDirectory(): Promise<string | null>
  /** 写二进制文件(本地 assets 模式图片落盘),自动创建父目录 */
  writeBinaryFile(path: string, bytes: Uint8Array): Promise<void>
  /** 读二进制文件(绑定/另存为时迁移正文引用的 assets 图片用) */
  readBinaryFile(path: string): Promise<Uint8Array>
  /** 删除单个普通文件(另存为后可选清理原文件,须用户确认) */
  deleteFile(path: string): Promise<void>
  /** 平台默认的图片根目录(应用数据目录) */
  defaultAssetsRoot(): Promise<string>
  /** 用系统默认方式打开文件/目录(资源管理器、图片查看器等) */
  openPath(path: string): Promise<void>
  /** 在文件管理器中定位文件(父目录打开并选中该项) */
  revealItemInDir(path: string): Promise<void>
}
