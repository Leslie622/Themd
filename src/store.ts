/** Compatibility facade. New code should import NotebookController directly. */
import { useSyncExternalStore } from 'react'
import { applicationServices } from '@/app/services'
import { countWords, deriveTitle, type Folder, type Note } from '@/modules/notebook/domain/note'

const controller = applicationServices.notebook
void controller.hydrate().catch((error: unknown) => console.error('笔记初始化失败:', error))

export type { Folder, Note }
export { countWords, deriveTitle }

export interface NotebookFacade {
  notes: Note[]
  folders: Folder[]
  activeId: string | null
  hydrated: boolean
  createNote: (title?: string, content?: string) => string
  updateNote: (id: string, content: string) => void
  renameNote: (id: string, title: string) => void
  removeNote: (id: string) => void
  setActive: (id: string | null) => void
  setNoteTheme: (id: string, themeId: string | null) => void
  createFolder: (name: string) => string
  renameFolder: (id: string, name: string) => void
  removeFolder: (id: string) => void
  removeFolderWithNotes: (id: string) => void
  setNoteFolder: (id: string, folderId: string | null) => void
}

const facade: NotebookFacade = {
  get notes() { return controller.getSnapshot().notes },
  get folders() { return controller.getSnapshot().folders },
  get activeId() { return controller.getSnapshot().activeId },
  get hydrated() { return controller.getSnapshot().hydrated },
  createNote: controller.createNote.bind(controller),
  updateNote: controller.updateNote.bind(controller),
  renameNote: controller.renameNote.bind(controller),
  removeNote: controller.removeNote.bind(controller),
  setActive: controller.setActive.bind(controller),
  setNoteTheme: controller.setNoteTheme.bind(controller),
  createFolder: controller.createFolder.bind(controller),
  renameFolder: controller.renameFolder.bind(controller),
  removeFolder: controller.removeFolder.bind(controller),
  removeFolderWithNotes: controller.removeFolderWithNotes.bind(controller),
  setNoteFolder: controller.setNoteFolder.bind(controller),
}

export function useNotebook<T>(selector: (state: NotebookFacade) => T): T {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return selector(facade)
}

export { controller as notebookController }
