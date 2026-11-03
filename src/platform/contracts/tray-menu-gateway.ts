/**
 * 托盘右键自绘菜单(仅桌面端)。菜单窗口由 Rust 启动时创建、常驻隐藏,
 * 右键托盘时经 tray://open 通知本窗口;窗口渲染 shadcn DropdownMenu,
 * 量出尺寸后交 Rust 落位显示。坐标与缩放全部由 Rust 处理,前端只给逻辑像素。
 */
export interface TrayMenuAnchor {
  /** 光标物理像素坐标(菜单落位基准:左缘贴 x、底缘贴 y) */
  cursorX: number
  cursorY: number
}

export interface TrayMenuGateway {
  /** 托盘右键弹出请求(每次开菜单都会通知,含最新光标位置) */
  onOpenRequest(listener: (anchor: TrayMenuAnchor) => void): Promise<() => void>
  /** 菜单窗口失焦(点了窗口外,窗口已被 Rust 隐藏);菜单态应同步收回 */
  onBlur(listener: () => void): Promise<() => void>
  /** 回传量出的菜单尺寸(逻辑像素),Rust 换算缩放、落位并显示窗口 */
  commitGeometry(cursorX: number, cursorY: number, width: number, height: number): Promise<void>
  /**
   * 尺寸校正:按窗口真实 devicePixelRatio 换算的物理像素调整窗口大小并重新
   * 锚定(左缘贴光标、底缘贴光标)。仅对可见窗口生效——失焦已藏的窗口不复活。
   */
  resizeTrayMenu(cursorX: number, cursorY: number, widthPx: number, heightPx: number): Promise<void>
  /** 收回菜单并隐藏窗口(Esc / 选中菜单项) */
  close(): Promise<void>
  /** 菜单项:显示主界面 */
  showMainWindow(): Promise<void>
  /** 菜单项:退出应用(先冲刷未写回编辑再退进程) */
  quitApp(): Promise<void>
}
