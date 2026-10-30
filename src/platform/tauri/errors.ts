export class PlatformCommandError extends Error {
  readonly command: string
  readonly cause: unknown
  constructor(command: string, cause: unknown) {
    super(errorMessage(cause))
    this.command = command
    this.cause = cause
    this.name = 'PlatformCommandError'
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try { return JSON.stringify(error) } catch { return '桌面命令执行失败' }
}
