/**
 * 笔记状态的 React 绑定层:useNotebook(selector) 订阅 NotebookController 快照,
 * 命令经 notebookController 直连。Controller 是笔记事实来源(application 层),
 * 组件不经它自己的 React hook,统一从本文件取状态(含 store-themes 同款约定)。
 */
import { useSyncExternalStore } from 'react'
import { applicationServices } from '@/app/services'
import type { Folder, Note } from '@/modules/notebook/domain/note'

const controller = applicationServices.notebook
void controller.hydrate().catch((error: unknown) => console.error('笔记初始化失败:', error))

export type { Note }

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
}

export function useNotebook<T>(selector: (state: NotebookFacade) => T): T {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return selector(facade)
}

export { controller as notebookController }
