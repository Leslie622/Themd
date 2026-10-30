import type { Note, NotebookSnapshot } from '../domain/note'
import { deriveTitle, NOTEBOOK_SCHEMA_VERSION } from '../domain/note'

export interface NoteRepository {
  load(): Promise<NotebookSnapshot | null>
  save(snapshot: NotebookSnapshot): Promise<void>
}

export interface NotebookState extends NotebookSnapshot {
  activeId: string | null
  hydrated: boolean
}

type Listener = () => void

const WELCOME = '# 欢迎使用 MD 笔记本\n\n开始记录你的想法吧。'

function initialState(): NotebookState {
  const note: Note = {
    id: 'welcome-note',
    title: '欢迎使用 MD 笔记本',
    content: WELCOME,
    updatedAt: Date.now(),
  }
  return { schemaVersion: NOTEBOOK_SCHEMA_VERSION, notes: [note], folders: [], activeId: note.id, hydrated: false }
}

export class NotebookController {
  private state: NotebookState = initialState()
  private readonly listeners = new Set<Listener>()
  private saveTimer: ReturnType<typeof setTimeout> | undefined

  private readonly repository: NoteRepository

  constructor(repository: NoteRepository) {
    this.repository = repository
  }

  getSnapshot = (): NotebookState => this.state
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private publish(next: NotebookState): void {
    this.state = next
    for (const listener of this.listeners) listener()
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      const snapshot = {
        schemaVersion: this.state.schemaVersion,
        notes: this.state.notes,
        folders: this.state.folders,
      }
      void this.repository.save(snapshot).catch((error: unknown) => console.error('笔记保存失败:', error))
    }, 200)
  }

  async hydrate(): Promise<void> {
    try {
      const saved = await this.repository.load()
      if (saved && saved.schemaVersion === NOTEBOOK_SCHEMA_VERSION) {
        const activeId = saved.notes[0]?.id ?? null
        this.state = { ...saved, activeId, hydrated: true }
      } else {
        this.state = { ...this.state, hydrated: true }
      }
    } catch (error) {
      console.error('笔记存储水合失败:', error)
      this.state = { ...this.state, hydrated: true }
    }
    for (const listener of this.listeners) listener()
  }

  /** Explicit recovery/import entry point for users of the pre-architecture storage. */
  importSnapshot(snapshot: NotebookSnapshot): void {
    this.publish({ ...snapshot, activeId: snapshot.notes[0]?.id ?? null, hydrated: true })
  }

  createNote(title?: string, content = ''): string {
    const id = crypto.randomUUID()
    const note: Note = { id, title: title || deriveTitle(content) || '新笔记', content, updatedAt: Date.now() }
    this.publish({ ...this.state, notes: [note, ...this.state.notes], activeId: id })
    return id
  }

  updateNote(id: string, content: string): void {
    this.publish({
      ...this.state,
      notes: this.state.notes.map((note) => {
        if (note.id !== id) return note
        const derived = deriveTitle(content)
        return { ...note, content, updatedAt: Date.now(), title: !note.titleCustom && derived ? derived : note.title }
      }),
    })
  }

  renameNote(id: string, title: string): void {
    this.publish({ ...this.state, notes: this.state.notes.map((n) => n.id === id ? { ...n, title: title || n.title, titleCustom: true } : n) })
  }

  removeNote(id: string): void {
    const notes = this.state.notes.filter((note) => note.id !== id)
    this.publish({ ...this.state, notes, activeId: this.state.activeId === id ? (notes[0]?.id ?? null) : this.state.activeId })
  }

  setActive(id: string | null): void { this.publish({ ...this.state, activeId: id }) }
  setNoteTheme(id: string, themeId: string | null): void { this.publish({ ...this.state, notes: this.state.notes.map((n) => n.id === id ? { ...n, themeId: themeId ?? undefined } : n) }) }
  createFolder(name: string): string { const id = crypto.randomUUID(); this.publish({ ...this.state, folders: [...this.state.folders, { id, name, order: this.state.folders.length }] }); return id }
  renameFolder(id: string, name: string): void { this.publish({ ...this.state, folders: this.state.folders.map((f) => f.id === id ? { ...f, name } : f) }) }
  removeFolder(id: string): void { this.publish({ ...this.state, folders: this.state.folders.filter((f) => f.id !== id), notes: this.state.notes.map((n) => n.folderId === id ? { ...n, folderId: undefined } : n) }) }
  removeFolderWithNotes(id: string): void { const notes = this.state.notes.filter((n) => n.folderId !== id); this.publish({ ...this.state, folders: this.state.folders.filter((f) => f.id !== id), notes, activeId: notes.some((n) => n.id === this.state.activeId) ? this.state.activeId : (notes[0]?.id ?? null) }) }
  setNoteFolder(id: string, folderId: string | null): void { this.publish({ ...this.state, notes: this.state.notes.map((n) => n.id === id ? { ...n, folderId: folderId ?? undefined } : n) }) }
}
