export interface ImportedFile { folderPath: string; title: string; content: string }
export interface SaveTextInput { defaultName: string; contents: string; filterName: string; extensions: string[] }
export interface SavePathInput { defaultName: string; filterName: string; extensions: string[] }
export type SaveResult = { kind: 'canceled' } | { kind: 'web' } | { kind: 'saved'; path: string }
export interface FileGateway {
  pickFiles(): Promise<ImportedFile[]>
  pickFolder(): Promise<ImportedFile[] | null>
  chooseSavePath(input: SavePathInput): Promise<string | null>
  saveText(input: SaveTextInput): Promise<SaveResult>
  /** 选择目录返回绝对路径(本地图片根目录);不支持/取消返回 null */
  pickDirectory(): Promise<string | null>
  /** 写二进制文件(本地 assets 模式图片落盘),自动创建父目录 */
  writeBinaryFile(path: string, bytes: Uint8Array): Promise<void>
  /** 平台默认的图片根目录(桌面端为应用数据目录);Web 无本地目录能力返回空串 */
  defaultAssetsRoot(): Promise<string>
  /** 用系统默认方式打开文件/目录(资源管理器、图片查看器等);Web 端抛错 */
  openPath(path: string): Promise<void>
  /** 在文件管理器中定位文件(父目录打开并选中该项);Web 端抛错 */
  revealItemInDir(path: string): Promise<void>
}
