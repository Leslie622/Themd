import { open, save } from '@tauri-apps/plugin-dialog'
import type { FileGateway, ImportedFile } from '../contracts'
import { invoke } from './commands'

const noteFilters = [{ name: 'Markdown 文档', extensions: ['md', 'markdown', 'txt'] }]

export function createTauriFileGateway(): FileGateway {
  return {
    async pickFiles() {
      const selected = await open({ multiple: true, filters: noteFilters })
      const paths = selected ? (Array.isArray(selected) ? selected : [selected]) : []
      if (!paths.length) return []
      return invoke<ImportedFile[]>('read_text_files', { paths })
    },
    async pickFolder() {
      const root = await open({ directory: true })
      return typeof root === 'string' ? invoke('read_folder_notes', { root }) : null
    },
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
    async writeBinaryFile(path, bytes) {
      await invoke('write_image_file', { path, bytes: Array.from(bytes) })
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
    async revealItemInDir(path) {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealItemInDir(path)
    },
  }
}
