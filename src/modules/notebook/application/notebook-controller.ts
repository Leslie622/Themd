import type { Note, NotebookSnapshot } from '../domain/note'
import { deriveTitle, fileNameStem, NOTEBOOK_SCHEMA_VERSION } from '../domain/note'
import type { FileLinkGateway, FsChangeEvent } from '@/platform/contracts'
import { appEvents } from '@/shared/events/app-events'

export interface NoteRepository {
  load(): Promise<NotebookSnapshot | null>
  save(snapshot: NotebookSnapshot): Promise<void>
}

export interface NotebookState extends NotebookSnapshot {
  activeId: string | null
  hydrated: boolean
  /** 绑定文件已在磁盘上消失(外部删除/移走)的笔记 id;UI 会话态,不进快照 */
  fileMissingIds: ReadonlySet<string>
}

type Listener = () => void

const WELCOME = '# 欢迎使用 MD 笔记本\n\n开始记录你的想法吧。'

/** 编辑后写回绑定文件的防抖间隔 */
const WRITE_BACK_DEBOUNCE_MS = 500
/** 监听集合(watchPaths)全量同步的防抖间隔 */
const WATCH_SYNC_DEBOUNCE_MS = 500
/** 旧版快照(无 sourcePath 字段)仍然可读 */
const SUPPORTED_SCHEMA_VERSIONS = [1, 2]

function initialState(): NotebookState {
  const note: Note = {
    id: 'welcome-note',
    title: '欢迎使用 MD 笔记本',
    content: WELCOME,
    updatedAt: Date.now(),
  }
  return {
    schemaVersion: NOTEBOOK_SCHEMA_VERSION,
    notes: [note],
    folders: [],
    activeId: note.id,
    hydrated: false,
    fileMissingIds: new Set<string>(),
  }
}

export class NotebookController {
  private state: NotebookState = initialState()
  private readonly listeners = new Set<Listener>()
  private saveTimer: ReturnType<typeof setTimeout> | undefined

  /** noteId → 写回防抖 timer */
  private writeTimers = new Map<string, ReturnType<typeof setTimeout>>()
  /** 有未写回本地编辑的文件绝对路径(冲突判定依据) */
  private dirtyPaths = new Set<string>()
  /** 本应用最近一次写回的内容,用于抑制自家写回触发的 watcher 回声 */
  private lastWritten = new Map<string, string>()
  private watchTimer: ReturnType<typeof setTimeout> | undefined

  private readonly repository: NoteRepository
  private readonly fileLink: FileLinkGateway | null

  constructor(repository: NoteRepository, fileLink?: FileLinkGateway | null) {
    this.repository = repository
    this.fileLink = fileLink ?? null
    this.fileLink?.onFsChanges((events) => void this.handleFsEvents(events))
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
      const snapshot: NotebookSnapshot = {
        schemaVersion: this.state.schemaVersion,
        notes: this.state.notes,
        folders: this.state.folders,
      }
      void this.repository.save(snapshot).catch((error: unknown) => console.error('笔记保存失败:', error))
    }, 200)
    this.scheduleWatchSync()
  }

  async hydrate(): Promise<void> {
    try {
      const saved = await this.repository.load()
      if (saved && SUPPORTED_SCHEMA_VERSIONS.includes(saved.schemaVersion)) {
        const activeId = saved.notes[0]?.id ?? null
        // v1 快照无 sourcePath 字段,读入后统一按 v2 协议继续保存
        this.state = { ...this.state, ...saved, schemaVersion: NOTEBOOK_SCHEMA_VERSION, activeId, hydrated: true, fileMissingIds: new Set() }
      } else {
        this.state = { ...this.state, hydrated: true }
      }
    } catch (error) {
      console.error('笔记存储水合失败:', error)
      this.state = { ...this.state, hydrated: true }
    }
    for (const listener of this.listeners) listener()
    this.scheduleWatchSync()
  }

  /** Explicit recovery/import entry point for users of the pre-architecture storage. */
  importSnapshot(snapshot: NotebookSnapshot): void {
    this.publish({
      ...snapshot,
      activeId: snapshot.notes[0]?.id ?? null,
      hydrated: true,
      fileMissingIds: new Set(),
    })
  }

  createNote(title?: string, content = '', sourcePath?: string): string {
    const id = crypto.randomUUID()
    const note: Note = {
      id,
      title: title || deriveTitle(content) || '新笔记',
      content,
      updatedAt: Date.now(),
      ...(sourcePath ? { sourcePath } : {}),
    }
    this.publish({ ...this.state, notes: [note, ...this.state.notes], activeId: id })
    return id
  }

  updateNote(id: string, content: string): void {
    const target = this.state.notes.find((note) => note.id === id)
    this.publish({
      ...this.state,
      notes: this.state.notes.map((note) => {
        if (note.id !== id) return note
        const derived = deriveTitle(content)
        return { ...note, content, updatedAt: Date.now(), title: !note.titleCustom && derived ? derived : note.title }
      }),
    })
    if (target?.sourcePath) this.scheduleWriteBack(id, target.sourcePath)
  }

  renameNote(id: string, title: string): void {
    this.publish({ ...this.state, notes: this.state.notes.map((n) => n.id === id ? { ...n, title: title || n.title, titleCustom: true } : n) })
  }

  removeNote(id: string): void {
    // 移除笔记时放弃未写回的编辑(用户显式删除,不应把内容复活到磁盘)
    this.cancelPendingWriteBack(id)
    const notes = this.state.notes.filter((note) => note.id !== id)
    this.publish({ ...this.state, notes, activeId: this.state.activeId === id ? (notes[0]?.id ?? null) : this.state.activeId })
  }

  setActive(id: string | null): void {
    const previous = this.state.activeId
    if (previous) this.flushNote(previous)
    this.publish({ ...this.state, activeId: id })
  }

  setNoteTheme(id: string, themeId: string | null): void { this.publish({ ...this.state, notes: this.state.notes.map((n) => n.id === id ? { ...n, themeId: themeId ?? undefined } : n) }) }
  createFolder(name: string): string { const id = crypto.randomUUID(); this.publish({ ...this.state, folders: [...this.state.folders, { id, name, order: this.state.folders.length }] }); return id }
  renameFolder(id: string, name: string): void { this.publish({ ...this.state, folders: this.state.folders.map((f) => f.id === id ? { ...f, name } : f) }) }
  removeFolder(id: string): void { this.publish({ ...this.state, folders: this.state.folders.filter((f) => f.id !== id), notes: this.state.notes.map((n) => n.folderId === id ? { ...n, folderId: undefined } : n) }) }
  removeFolderWithNotes(id: string): void {
    this.state.notes.filter((n) => n.folderId === id).forEach((n) => this.cancelPendingWriteBack(n.id))
    const notes = this.state.notes.filter((n) => n.folderId !== id)
    this.publish({ ...this.state, folders: this.state.folders.filter((f) => f.id !== id), notes, activeId: notes.some((n) => n.id === this.state.activeId) ? this.state.activeId : (notes[0]?.id ?? null) })
  }
  setNoteFolder(id: string, folderId: string | null): void { this.publish({ ...this.state, notes: this.state.notes.map((n) => n.id === id ? { ...n, folderId: folderId ?? undefined } : n) }) }

  // ── 文件绑定:双向同步 ──────────────────────────────────────────────

  /**
   * 把笔记绑定到磁盘文件:设置 sourcePath 并立即把当前内容写盘一次。
   * 失败抛错由调用方处理(绑定期内容尚未落盘)。
   */
  async bindNoteToFile(id: string, path: string): Promise<void> {
    this.publish({
      ...this.state,
      notes: this.state.notes.map((n) => n.id === id ? { ...n, sourcePath: path } : n),
    })
    const note = this.state.notes.find((n) => n.id === id)
    if (!note || !this.fileLink) return
    await this.fileLink.writeTextFile(path, note.content)
    this.lastWritten.set(path, note.content)
    this.scheduleWatchSync()
  }

  /** 立即写回该笔记的未落盘编辑;无未写回内容时 no-op(防抖写回失败后仍可强制重写) */
  flushNote(id: string): void {
    const note = this.state.notes.find((n) => n.id === id)
    if (!note?.sourcePath) return
    const timer = this.writeTimers.get(id)
    if (timer === undefined && !this.dirtyPaths.has(note.sourcePath)) return
    if (timer !== undefined) {
      clearTimeout(timer)
      this.writeTimers.delete(id)
    }
    void this.writeBack(note.id, note.sourcePath)
  }

  /** 立即写回所有未落盘编辑(切窗口/退出前的兜底) */
  flushAll(): void {
    for (const id of [...this.writeTimers.keys()]) this.flushNote(id)
  }

  /** 冲突处置:放弃本地未写回编辑,重读磁盘版本 */
  async reloadNoteFromDisk(id: string): Promise<void> {
    const note = this.state.notes.find((n) => n.id === id)
    if (!note?.sourcePath || !this.fileLink) return
    this.cancelPendingWriteBack(id)
    const disk = await this.fileLink.readTextFile(note.sourcePath).catch(() => null)
    if (disk === null) return
    this.applyExternalContent(id, disk)
  }

  /** 冲突处置:保留本地版本(立即写回覆盖磁盘) */
  keepLocalNote(id: string): void {
    this.flushNote(id)
  }

  private scheduleWriteBack(id: string, path: string): void {
    if (!this.fileLink) return
    this.dirtyPaths.add(path)
    if (this.writeTimers.has(id)) clearTimeout(this.writeTimers.get(id))
    this.writeTimers.set(id, setTimeout(() => {
      this.writeTimers.delete(id)
      void this.writeBack(id, path)
    }, WRITE_BACK_DEBOUNCE_MS))
  }

  private async writeBack(id: string, path: string): Promise<void> {
    if (!this.fileLink) return
    const note = this.state.notes.find((n) => n.id === id)
    // 笔记已删/已改绑其他路径:本次写回作废
    if (!note || note.sourcePath !== path) {
      this.dirtyPaths.delete(path)
      return
    }
    try {
      await this.fileLink.writeTextFile(path, note.content)
      this.lastWritten.set(path, note.content)
      this.dirtyPaths.delete(path)
      // 文件此前失联(外部删除),这次写回等于重建,解除失联标记
      if (this.state.fileMissingIds.has(id)) {
        const fileMissingIds = new Set(this.state.fileMissingIds)
        fileMissingIds.delete(id)
        this.publish({ ...this.state, fileMissingIds })
      }
    } catch (error) {
      console.error('写回绑定文件失败:', error)
    }
  }

  private cancelPendingWriteBack(id: string): void {
    const timer = this.writeTimers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      this.writeTimers.delete(id)
    }
    const note = this.state.notes.find((n) => n.id === id)
    if (note?.sourcePath) this.dirtyPaths.delete(note.sourcePath)
  }

  private applyExternalContent(id: string, content: string): void {
    this.publish({
      ...this.state,
      notes: this.state.notes.map((note) => {
        if (note.id !== id) return note
        const derived = deriveTitle(content)
        return { ...note, content, updatedAt: Date.now(), title: !note.titleCustom && derived ? derived : note.title }
      }),
    })
  }

  private async handleFsEvents(events: FsChangeEvent[]): Promise<void> {
    if (!this.fileLink) return
    for (const event of events) {
      if (event.kind === 'removed') {
        const note = this.noteByPath(event.path)
        if (!note) continue
        // removed 不直接相信:自家原子写用 rename 替换目标时,Windows 的目录
        // 通知会把「目标被替换」报成 removed。读一次验证——读得到说明文件
        // 还在(自家写回回声,或外部以替换方式改动),按 modified 逻辑判定;
        // 真读不到才标记失联。
        const disk = await this.fileLink.readTextFile(event.path).catch(() => null)
        if (disk === null) {
          const fileMissingIds = new Set(this.state.fileMissingIds)
          fileMissingIds.add(note.id)
          this.publish({ ...this.state, fileMissingIds })
          continue
        }
        this.handleDiskContent(event.path, note, disk)
        continue
      }
      if (event.kind === 'renamed') {
        const note = this.noteByPath(event.oldPath)
        if (!note) continue
        const stem = fileNameStem(event.newPath)
        this.publish({
          ...this.state,
          notes: this.state.notes.map((n) => n.id === note.id
            ? { ...n, sourcePath: event.newPath, title: !n.titleCustom && stem ? stem : n.title }
            : n),
        })
        continue
      }
      // modified:自家写回的回声(内容与上次写回一致)直接忽略
      const note = this.noteByPath(event.path)
      if (!note) continue
      const disk = await this.fileLink.readTextFile(event.path).catch(() => null)
      if (disk === null) continue
      this.handleDiskContent(event.path, note, disk)
    }
  }

  /**
   * 磁盘新内容 vs 本地状态的三级判定:
   * 1. 与笔记当前内容一致 → no-op(多半是自家写回的回声)
   * 2. 与最近一次写回内容一致 → 自家上一版的回声,忽略(用户可能正继续编辑)
   * 3. 有未写回编辑 → 冲突,交给 UI 弹窗二选一;干净 → 静默重载磁盘版
   */
  private handleDiskContent(path: string, note: Note, disk: string): void {
    if (disk === note.content) return
    if (disk === this.lastWritten.get(path)) return
    if (this.dirtyPaths.has(path)) {
      appEvents.emit('fs-conflict', { noteId: note.id, path })
      return
    }
    this.applyExternalContent(note.id, disk)
  }

  private noteByPath(path: string): Note | undefined {
    return this.state.notes.find((note) => note.sourcePath === path)
  }

  /** 把当前所有绑定路径全量同步给 watcher(增删改笔记后自动跟上) */
  private scheduleWatchSync(): void {
    if (!this.fileLink) return
    if (this.watchTimer) clearTimeout(this.watchTimer)
    this.watchTimer = setTimeout(() => {
      this.watchTimer = undefined
      const paths = [...new Set(this.state.notes.map((note) => note.sourcePath).filter((p): p is string => Boolean(p)))]
      void this.fileLink?.watchPaths(paths).catch((error: unknown) => console.error('文件监听同步失败:', error))
    }, WATCH_SYNC_DEBOUNCE_MS)
  }
}
