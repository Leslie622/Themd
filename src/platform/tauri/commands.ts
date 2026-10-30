import { PlatformCommandError } from './errors'

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core')
  try {
    return await tauriInvoke<T>(command, args)
  } catch (error) {
    throw new PlatformCommandError(command, error)
  }
}
