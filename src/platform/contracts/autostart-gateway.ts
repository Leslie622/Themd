/**
 * 开机自启能力(仅桌面端有意义;Web 实现为空操作)。
 * 底层是 Tauri autostart 插件写 HKCU Run 注册表键,应用退出不回收——
 * 用户关掉开关才会移除。
 */
export interface AutostartGateway {
  /** 当前是否已启用开机自启 */
  isEnabled(): Promise<boolean>
  /** 启用/停用开机自启 */
  setEnabled(enabled: boolean): Promise<void>
}
