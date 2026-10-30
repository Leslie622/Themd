export interface WindowGateway {
  minimize(): Promise<void>
  toggleMaximize(): Promise<void>
  close(): Promise<void>
  isMaximized(): Promise<boolean>
  onMaximizedChange(listener: (maximized: boolean) => void): Promise<() => void>
}
