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
  }
}
