import type { FileLinkGateway, FsChangeEvent } from '../contracts'
import { invoke } from './commands'

const FS_CHANGED_EVENT = 'fs-changed'

export function createTauriFileLinkGateway(): FileLinkGateway {
  return {
    async readTextFile(path) {
      return invoke<string>('read_text_file', { path })
    },
    async writeTextFile(path, contents) {
      await invoke('write_text_file', { path, contents })
    },
    async watchPaths(paths) {
      await invoke('watch_paths', { paths })
    },
    async onFsChanges(listener) {
      const { listen } = await import('@tauri-apps/api/event')
      const unlisten = await listen<FsChangeEvent[]>(FS_CHANGED_EVENT, (event) => listener(event.payload))
      return unlisten
    },
    async moveFile(src, destDir) {
      return invoke<string>('move_note_file', { src, destDir })
    },
    async renameFile(src, newName) {
      return invoke<string>('rename_note_file', { src, newName })
    },
    async trashFile(path) {
      await invoke('trash_file', { path })
    },
    async renameDirectory(oldPath, newPath) {
      await invoke('rename_directory', { oldPath, newPath })
    },
    async deleteDirectory(path) {
      await invoke('delete_directory', { path })
    },
    async uniqueDestination(dir, fileName) {
      return invoke<string>('unique_destination', { dir, fileName })
    },
  }
}
