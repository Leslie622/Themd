import { open, save } from '@tauri-apps/plugin-dialog'
import type { FileGateway } from '../contracts'
import { invoke } from './commands'

export function createTauriFileGateway(): FileGateway {
  return {
    async chooseSavePath(input) {
      return (await save({ defaultPath: input.defaultName, filters: [{ name: input.filterName, extensions: input.extensions }] })) ?? null
    },
    async saveText(input) {
      const path = await this.chooseSavePath(input)
      if (!path) return { kind: 'canceled' }
      await invoke('write_text_file', { path, contents: input.contents })
      return { kind: 'saved', path }
    },
    async pickDirectory() {
      const dir = await open({ directory: true })
      return typeof dir === 'string' ? dir : null
    },
    async pickImageFile() {
      const selected = await open({
        multiple: false,
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] }],
      })
      if (typeof selected !== 'string') return null
      const { basename } = await import('@tauri-apps/api/path')
      return { path: selected, name: await basename(selected) }
    },
    async writeBinaryFile(path, bytes) {
      await invoke('write_image_file', { path, bytes: Array.from(bytes) })
    },
    async readBinaryFile(path) {
      return invoke<number[]>('read_binary_file', { path }).then((bytes) => Uint8Array.from(bytes))
    },
    async defaultAssetsRoot() {
      // 语义 = 图片文件的最终存放目录(不再在其下拼 assets/ 子层,
      // 否则默认值会出现 assets/assets/ 嵌套)。正文统一引用
      // assets/<文件名> 相对路径,显示层由 image-src 解析回实际位置
      const { appDataDir, join } = await import('@tauri-apps/api/path')
      return join(await appDataDir(), 'assets')
    },
    async openPath(path) {
      const { openPath } = await import('@tauri-apps/plugin-opener')
      await openPath(path)
    },
    async openUrl(url) {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
    },
    async revealItemInDir(path) {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealItemInDir(path)
    },
  }
}
