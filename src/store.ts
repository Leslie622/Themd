/** Compatibility facade. New code should import NotebookController directly. */
import { useSyncExternalStore } from 'react'
import { applicationServices } from '@/app/services'
import { countWords, type Folder, type Note } from '@/modules/notebook/domain/note'

const controller = applicationServices.notebook
void controller.hydrate().catch((error: unknown) => console.error('笔记初始化失败:', error))

export type { Folder, Note }
export { countWords }

export interface NotebookFacade {
  notes: Note[]
  folders: Folder[]
  activeId: string | null
  hydrated: boolean
  workspaceRoot: string | null
  fileMissingIds: ReadonlySet<string>
  updateNote: (id: string, content: string) => void
  renameNote: (id: string, title: string) => Promise<void>
  removeNote: (id: string) => Promise<void>
  setActive: (id: string | null) => void
  setNoteTheme: (id: string, themeId: string | null) => void
  openWorkspace: (root: string) => Promise<void>
  closeWorkspace: () => Promise<void>
  createNoteInDir: (dir: string) => Promise<string>
  createFolder: (path: string) => string
  renameFolder: (id: string, name: string) => Promise<void>
  removeFolder: (id: string) => Promise<void>
  moveNoteToFolder: (id: string, folderId: string) => Promise<void>
  createNoteInFolder: (folderId: string) => Promise<string>
  bindNoteToFile: (id: string, path: string) => Promise<void>
  flushNote: (id: string) => void
  flushAll: () => void
  reloadNoteFromDisk: (id: string) => Promise<void>
  keepLocalNote: (id: string) => void
}

const facade: NotebookFacade = {
  get notes() { return controller.getSnapshot().notes },
  get folders() { return controller.getSnapshot().folders },
  get activeId() { return controller.getSnapshot().activeId },
  get hydrated() { return controller.getSnapshot().hydrated },
  get workspaceRoot() { return controller.getSnapshot().workspaceRoot },
  get fileMissingIds() { return controller.getSnapshot().fileMissingIds },
  updateNote: controller.updateNote.bind(controller),
  renameNote: controller.renameNote.bind(controller),
  removeNote: controller.removeNote.bind(controller),
  setActive: controller.setActive.bind(controller),
  setNoteTheme: controller.setNoteTheme.bind(controller),
  openWorkspace: controller.openWorkspace.bind(controller),
  closeWorkspace: controller.closeWorkspace.bind(controller),
  createNoteInDir: controller.createNoteInDir.bind(controller),
  createFolder: controller.createFolder.bind(controller),
  renameFolder: controller.renameFolder.bind(controller),
  removeFolder: controller.removeFolder.bind(controller),
  moveNoteToFolder: controller.moveNoteToFolder.bind(controller),
  createNoteInFolder: controller.createNoteInFolder.bind(controller),
  bindNoteToFile: controller.bindNoteToFile.bind(controller),
  flushNote: controller.flushNote.bind(controller),
  flushAll: controller.flushAll.bind(controller),
  reloadNoteFromDisk: controller.reloadNoteFromDisk.bind(controller),
  keepLocalNote: controller.keepLocalNote.bind(controller),
}

export function useNotebook<T>(selector: (state: NotebookFacade) => T): T {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return selector(facade)
}

export { controller as notebookController }
