import type { Folder, Note, NotebookSnapshot } from '../domain/note'
import { fileNameStem, NOTEBOOK_SCHEMA_VERSION } from '../domain/note'
import type { FileLinkGateway, FsChangeEvent } from '@/platform/contracts'
import { appEvents } from '@/shared/events/app-events'
import { isPathUnder, isSamePath, normalizePath, noteDirOf, pathBaseName, sanitizeFileName, swapPathPrefix } from '@/shared/paths'

export interface NoteRepository {
  load(): Promise<NotebookSnapshot | null>
  save(snapshot: NotebookSnapshot): Promise<void>
}

export interface NotebookState extends NotebookSnapshot {
  activeId: string | null
  hydrated: boolean
  /** 当前工作区根目录(folder-first:所有笔记都在其下);null = 未打开工作区 */
  workspaceRoot: string | null
  /** 绑定文件已在磁盘上消失(外部删除/移走)的笔记 id;UI 会话态,不进快照 */
  fileMissingIds: ReadonlySet<string>
}

type Listener = () => void

/** 编辑后写回绑定文件的防抖间隔 */
const WRITE_BACK_DEBOUNCE_MS = 500
/** 旧版快照仍然可读:v1/v2/v3 为库内+绑定混合时代,读入时丢弃未绑定笔记 */
const SUPPORTED_SCHEMA_VERSIONS = [1, 2, 3, 4]
/** 工作区自动入库/外部新建的扩展名(与 Rust read_folder_notes 一致) */
const NOTE_FILE_EXT = /\.(md|markdown|txt)$/i

function initialState(): NotebookState {
  return {
    schemaVersion: NOTEBOOK_SCHEMA_VERSION,
    notes: [],
    folders: [],
    activeId: null,
    hydrated: false,
    workspaceRoot: null,
    fileMissingIds: new Set<string>(),
  }
}

/** 由笔记目录集合重建文件夹实体(去重;层级由路径前缀派生,order 按路径序) */
function buildFoldersFromDirs(dirs: Iterable<string>): Folder[] {
  const seen = new Set<string>()
  const list: string[] = []
  for (const dir of dirs) {
    if (!dir) continue
    const key = normalizePath(dir)
    if (seen.has(key)) continue
    seen.add(key)
    list.push(dir)
  }
  list.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)))
  return list.map((path, i) => ({ id: crypto.randomUUID(), name: pathBaseName(path), path, order: i }))
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
  /** 写回失败的路径(同一文件只发一次 write-failed,成功写回后解除) */
  private failedPaths = new Set<string>()

  private readonly repository: NoteRepository
  private readonly fileLink: FileLinkGateway | null
  /** 绑定换目录时的图片资产随迁(组合根注入,见 lib/note-assets);fromDir=null = 库内首绑 */
  private readonly migrateAssets: ((content: string, fromDir: string | null, toDir: string) => Promise<void>) | null

  constructor(
    repository: NoteRepository,
    fileLink?: FileLinkGateway | null,
    migrateAssets?: (content: string, fromDir: string | null, toDir: string) => Promise<void>,
  ) {
    this.repository = repository
    this.fileLink = fileLink ?? null
    this.migrateAssets = migrateAssets ?? null
    this.fileLink?.onFsChanges((events) => void this.handleFsEvents(events))
  }

  getSnapshot = (): NotebookState => this.state
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private publish(next: NotebookState): void {
    // 不变式:每个绑定笔记所在目录都有 Folder 实体(文件夹=目录,派生自 sourcePath)
    this.state = this.ensureFoldersForBoundNotes(next)
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
  }

  async hydrate(): Promise<void> {
    try {
      const saved = await this.repository.load()
      if (saved && SUPPORTED_SCHEMA_VERSIONS.includes(saved.schemaVersion)) {
        const activeId = saved.notes[0]?.id ?? null
        // v≤3 → v4 迁移:folder-first 后不存在未绑定笔记,旧库内笔记按用户
        // 决定直接丢弃(当测试数据);绑定笔记保留(sourcePath/themeId 跟随)
        const notes: Note[] = saved.notes.filter((note): note is Note => Boolean(note.sourcePath))
        const folders: Folder[] = saved.folders.filter((f) => f && typeof f.path === 'string' && typeof f.name === 'string')
        this.state = { ...this.state, notes, folders, schemaVersion: NOTEBOOK_SCHEMA_VERSION, activeId, hydrated: true, fileMissingIds: new Set() }
      } else {
        this.state = { ...this.state, hydrated: true }
      }
    } catch (error) {
      console.error('笔记存储水合失败:', error)
      this.state = { ...this.state, hydrated: true }
    }
    for (const listener of this.listeners) listener()
  }

  // ── 工作区(folder-first) ────────────────────────────────────────────

  /**
   * 打开目录为工作区:递归读取 .md/.markdown/.txt,整表替换笔记列表
   * (树=磁盘)。同路径的既有笔记按 sourcePath 复用(id/themeId 跟随,
   * 重扫不丢笔记主题);不在新工作区的笔记连同文件夹一并移除。
   * 成功后对根建递归监听。
   */
  async openWorkspace(root: string): Promise<void> {
    if (!this.fileLink) throw new Error('当前环境不支持文件操作')
    // 去尾分隔符,后续 isPathUnder/前缀比较统一基准
    const normalizedRoot = root.replace(/[\\/]+$/, '')
    this.flushAll()
    const imported = await this.fileLink.readFolderNotes(normalizedRoot)
    const existing = new Map(this.state.notes.map((n) => [normalizePath(n.sourcePath), n]))
    const dirs = new Set<string>()
    const notes: Note[] = []
    for (const file of imported) {
      if (!file.filePath) continue // 非 UTF-8 等不可绑定文件不入库(Rust 侧已过滤,双保险)
      dirs.add(noteDirOf(file.filePath) ?? '')
      const prev = existing.get(normalizePath(file.filePath))
      notes.push(prev
        ? { ...prev, title: file.title, content: file.content }
        : {
            id: crypto.randomUUID(),
            title: file.title,
            content: file.content,
            updatedAt: Date.now(),
            sourcePath: file.filePath,
          })
    }
    this.publish({
      ...this.state,
      notes,
      folders: buildFoldersFromDirs(dirs),
      activeId: notes[0]?.id ?? null,
      workspaceRoot: normalizedRoot,
      fileMissingIds: new Set(),
    })
    await this.fileLink.watchWorkspace(normalizedRoot)
  }

  /** 关闭工作区:停止监听,清空笔记列表(快照由磁盘事实重建) */
  async closeWorkspace(): Promise<void> {
    this.flushAll()
    await this.fileLink?.watchWorkspace(null)
    this.publish({
      ...this.state,
      notes: [],
      folders: [],
      activeId: null,
      workspaceRoot: null,
      fileMissingIds: new Set(),
    })
  }

  /** 基础建笔记(内存态);磁盘落点由调用方先经 uniqueDestination 求得 */
  private createNoteRecord(title: string, content: string, sourcePath: string): Note {
    return { id: crypto.randomUUID(), title, content, updatedAt: Date.now(), sourcePath }
  }

  updateNote(id: string, content: string): void {
    const target = this.state.notes.find((note) => note.id === id)
    this.publish({
      ...this.state,
      notes: this.state.notes.map((note) => {
        if (note.id !== id) return note
        return { ...note, content, updatedAt: Date.now() }
      }),
    })
    if (target) this.scheduleWriteBack(id, target.sourcePath)
  }

  /** 在指定目录新建笔记:求无冲突路径 → 建笔记 → 立即写盘绑定 */
  async createNoteInDir(dir: string): Promise<string> {
    if (!this.fileLink) throw new Error('当前环境不支持文件操作')
    const dest = await this.fileLink.uniqueDestination(dir, sanitizeFileName('新笔记.md'))
    const note = this.createNoteRecord('新笔记', '', dest)
    this.publish({ ...this.state, notes: [note, ...this.state.notes], activeId: note.id })
    await this.bindNoteToFile(note.id, dest)
    return note.id
  }

  /**
   * 重命名笔记 = 同目录内磁盘文件改名(双向,重名自动加后缀),
   * 标题以实际落点的文件名为准。失败抛错,状态不动。
   */
  async renameNote(id: string, title: string): Promise<void> {
    const note = this.state.notes.find((n) => n.id === id)
    if (!note) return
    const clean = title.trim()
    if (!clean || clean === note.title) return
    if (!this.fileLink) throw new Error('当前环境不支持文件操作')
    const oldPath = note.sourcePath
    const wasDirty = this.dirtyPaths.has(oldPath)
    this.cancelPendingWriteBack(id)
    // 同名只差 .md 大小写等场景由 renameFile 的去重后缀兜底
    const actual = await this.fileLink.renameFile(oldPath, `${sanitizeFileName(clean)}.md`)
    this.lastWritten.delete(oldPath)
    const stem = fileNameStem(actual)
    this.publish({
      ...this.state,
      notes: this.state.notes.map((n) => n.id === id
        ? { ...n, sourcePath: actual, title: stem || clean }
        : n),
    })
    if (wasDirty) this.scheduleWriteBack(id, actual)
  }

  /**
   * 删除笔记:绑定笔记 = 磁盘文件移入系统回收站(Typora 语义,树=磁盘,可恢复);
   * 未绑定/失联笔记仅从应用移除。放弃未写回的编辑(文件已进回收站,
   * 不应把内容复活到磁盘)。移入回收站失败抛错,状态不动。
   */
  async removeNote(id: string): Promise<void> {
    this.cancelPendingWriteBack(id)
    const note = this.state.notes.find((n) => n.id === id)
    if (note && !this.state.fileMissingIds.has(id)) {
      if (!this.fileLink) throw new Error('当前环境不支持文件操作')
      await this.fileLink.trashFile(note.sourcePath)
    }
    const fileMissingIds = new Set(this.state.fileMissingIds)
    fileMissingIds.delete(id)
    const notes = this.state.notes.filter((note) => note.id !== id)
    this.publish({ ...this.state, notes, fileMissingIds, activeId: this.state.activeId === id ? (notes[0]?.id ?? null) : this.state.activeId })
  }

  setActive(id: string | null): void {
    const previous = this.state.activeId
    if (previous) this.flushNote(previous)
    this.publish({ ...this.state, activeId: id })
  }

  setNoteTheme(id: string, themeId: string | null): void { this.publish({ ...this.state, notes: this.state.notes.map((n) => n.id === id ? { ...n, themeId: themeId ?? undefined } : n) }) }

  // ── 文件夹 = 磁盘目录 ────────────────────────────────────────────────
  // 层级由 Folder.path 前缀派生(不存 parentId);绑定笔记归属其所在目录的
  // 文件夹,publish 时惰性补建。旧 folderId/setNoteFolder 已随 v3 移除。

  /** 注册目录为文件夹(幂等:同一路径返回既有文件夹) */
  createFolder(path: string): string {
    const existing = this.state.folders.find((f) => isSamePath(f.path, path))
    if (existing) return existing.id
    const id = crypto.randomUUID()
    this.publish({
      ...this.state,
      folders: [...this.state.folders, { id, name: pathBaseName(path), path, order: this.state.folders.length }],
    })
    return id
  }

  /**
   * 重命名文件夹 = 物理重命名磁盘目录:成功后其中子文件夹与笔记路径一并前缀换算,
   * 有未写回编辑的笔记改绑后立即补写。失败抛错,状态不动。
   */
  async renameFolder(id: string, newName: string): Promise<void> {
    const folder = this.state.folders.find((f) => f.id === id)
    if (!folder) return
    const clean = newName.trim()
    if (!clean || clean === folder.name) return
    if (!this.fileLink) throw new Error('当前环境不支持文件操作')
    const parent = noteDirOf(folder.path)
    const newPath = parent ? `${parent}\\${clean}` : clean
    const affected = this.state.notes.filter((n) => n.sourcePath && swapPathPrefix(n.sourcePath, folder.path, newPath) !== null)
    const dirtyAffected = affected
      .filter((n) => n.sourcePath && this.dirtyPaths.has(n.sourcePath))
      .map((n) => ({ id: n.id, newPath: swapPathPrefix(n.sourcePath as string, folder.path, newPath) as string }))
    affected.forEach((n) => this.cancelPendingWriteBack(n.id))
    await this.fileLink.renameDirectory(folder.path, newPath)
    this.publish({
      ...this.state,
      folders: this.state.folders.map((f) => {
        const swapped = swapPathPrefix(f.path, folder.path, newPath)
        return swapped ? { ...f, path: swapped, name: f.id === id ? clean : pathBaseName(swapped) } : f
      }),
      notes: this.state.notes.map((n) => {
        const swapped = n.sourcePath ? swapPathPrefix(n.sourcePath, folder.path, newPath) : null
        return swapped ? { ...n, sourcePath: swapped } : n
      }),
    })
    for (const item of dirtyAffected) this.scheduleWriteBack(item.id, item.newPath)
  }

  /**
   * 移动笔记到目录组:物理移动文件(引用的 assets 图片随迁)后改绑;
   * 有未写回编辑的笔记移动后立即补写新路径(编辑随笔记走,不被磁盘旧版覆盖)。
   */
  async moveNoteToFolder(id: string, folderId: string): Promise<void> {
    const folder = this.state.folders.find((f) => f.id === folderId)
    const note = this.state.notes.find((n) => n.id === id)
    if (!folder || !note) return
    if (!this.fileLink) throw new Error('当前环境不支持文件操作')
    if (isSamePath(noteDirOf(note.sourcePath) ?? '', folder.path)) return
    const wasDirty = this.dirtyPaths.has(note.sourcePath)
    this.cancelPendingWriteBack(id)
    const oldPath = note.sourcePath
    const oldDir = noteDirOf(oldPath)
    if (oldDir && this.migrateAssets) {
      await this.migrateAssets(note.content, oldDir, folder.path).catch((error: unknown) => {
        console.error('迁移笔记图片失败:', error)
      })
    }
    const newPath = await this.fileLink.moveFile(oldPath, folder.path)
    this.lastWritten.delete(oldPath)
    this.publish({
      ...this.state,
      notes: this.state.notes.map((n) => n.id === id ? { ...n, sourcePath: newPath } : n),
    })
    if (wasDirty) {
      // 立即写回(不等 500ms 防抖):抢在 watcher 事件前落盘,lastWritten
      // 让随后的回声被抑制,不弹冲突框。与重命名/目录换绑的补写同款保真。
      this.dirtyPaths.add(newPath)
      void this.writeBack(id, newPath)
    }
  }

  /** 在目录组里新建笔记(工作区根新建走 createNoteInDir) */
  async createNoteInFolder(folderId: string): Promise<string> {
    const folder = this.state.folders.find((f) => f.id === folderId)
    if (!folder) throw new Error('文件夹不存在')
    return this.createNoteInDir(folder.path)
  }

  /**
   * 删除文件夹 = 删除磁盘目录(Typora 文件树语义,网关侧移入回收站可恢复)。
   * 成功后其下子文件夹与笔记从应用一并移除——文件已不存在,笔记不能留着
   * 假装还能编辑。失败抛错,状态不动。
   */
  async removeFolder(id: string): Promise<void> {
    const folder = this.state.folders.find((f) => f.id === id)
    if (!folder) return
    if (!this.fileLink) throw new Error('当前环境不支持文件操作')
    await this.fileLink.deleteDirectory(folder.path)
    const affectedNotes = this.state.notes.filter((n) => isPathUnder(n.sourcePath, folder.path))
    affectedNotes.forEach((n) => this.cancelPendingWriteBack(n.id))
    const fileMissingIds = new Set(this.state.fileMissingIds)
    for (const note of affectedNotes) fileMissingIds.delete(note.id)
    this.publish({
      ...this.state,
      folders: this.state.folders.filter((f) => !isPathUnder(f.path, folder.path)),
      notes: this.state.notes.filter((n) => !isPathUnder(n.sourcePath, folder.path)),
      fileMissingIds,
      activeId: isPathUnder(this.state.notes.find((n) => n.id === this.state.activeId)?.sourcePath, folder.path)
        ? (this.state.notes.find((n) => !isPathUnder(n.sourcePath, folder.path))?.id ?? null)
        : this.state.activeId,
    })
  }

  // ── 文件绑定:双向同步 ──────────────────────────────────────────────

  /**
   * 把笔记绑定到磁盘文件:先写盘成功再设置 sourcePath(失败时状态不变,
   * 调用方拿抛错提示用户);失联标记随重新绑定解除(「另存为」自救路径)。
   */
  async bindNoteToFile(id: string, path: string): Promise<void> {
    if (!this.fileLink) throw new Error('当前环境不支持写入本地文件')
    const note = this.state.notes.find((n) => n.id === id)
    if (!note) return
    // 绑定换目录:正文引用的 assets 图片随迁(统一入口,首绑/另存为/移动即绑定
    // 都走到这里)。库内笔记 fromDir=null,来源回落全局图片根;同目录改绑跳过
    const fromDir = noteDirOf(note.sourcePath)
    const toDir = noteDirOf(path)
    if (toDir && this.migrateAssets && !isSamePath(fromDir ?? '', toDir)) {
      await this.migrateAssets(note.content, fromDir, toDir).catch((error: unknown) => {
        console.error('迁移笔记图片失败:', error)
      })
    }
    await this.fileLink.writeTextFile(path, note.content)
    this.lastWritten.set(path, note.content)
    const fileMissingIds = new Set(this.state.fileMissingIds)
    fileMissingIds.delete(id)
    // 绑定后标题与磁盘文件名统一:标题取文件名(双向同步的唯一事实在磁盘)
    this.publish({
      ...this.state,
      fileMissingIds,
      notes: this.state.notes.map((n) => n.id === id
        ? { ...n, sourcePath: path, title: fileNameStem(path) || n.title }
        : n),
    })
  }

  /** 立即写回该笔记的未落盘编辑;无未写回内容时 no-op(防抖写回失败后仍可强制重写) */
  flushNote(id: string): void {
    const note = this.state.notes.find((n) => n.id === id)
    if (!note) return
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
      // 写回成功:解除该文件的失败标记(下次再失败才重新报)
      this.failedPaths.delete(path)
      // 文件此前失联(外部删除),这次写回等于重建,解除失联标记
      if (this.state.fileMissingIds.has(id)) {
        const fileMissingIds = new Set(this.state.fileMissingIds)
        fileMissingIds.delete(id)
        this.publish({ ...this.state, fileMissingIds })
      }
    } catch (error) {
      console.error('写回绑定文件失败:', error)
      // 失败不能无声:本地脏编辑只活在内存里,用户必须知道保存没发生。
      // 同一文件只报首次(500ms 防抖下反复 toast 会刷屏),写成功后解除
      if (!this.failedPaths.has(path)) {
        this.failedPaths.add(path)
        appEvents.emit('write-failed', {
          noteId: id,
          path,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  private cancelPendingWriteBack(id: string): void {
    const timer = this.writeTimers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      this.writeTimers.delete(id)
    }
    const note = this.state.notes.find((n) => n.id === id)
    if (note?.sourcePath) {
      this.dirtyPaths.delete(note.sourcePath)
      this.failedPaths.delete(note.sourcePath)
    }
  }

  private applyExternalContent(id: string, content: string): void {
    this.publish({
      ...this.state,
      notes: this.state.notes.map((note) => {
        if (note.id !== id) return note
        return { ...note, content, updatedAt: Date.now() }
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
          if (this.dirtyPaths.has(event.path)) {
            // 有未写回编辑:标记失联走横幅自救(继续编辑会重建文件),不静默消失
            const fileMissingIds = new Set(this.state.fileMissingIds)
            fileMissingIds.add(note.id)
            this.publish({ ...this.state, fileMissingIds })
            continue
          }
          // 干净笔记:文件真没了 → 从列表移除(树=磁盘实时视图;文件在回收站可恢复)
          const notes = this.state.notes.filter((n) => n.id !== note.id)
          this.publish({
            ...this.state,
            notes,
            activeId: this.state.activeId === note.id ? (notes[0]?.id ?? null) : this.state.activeId,
          })
          continue
        }
        this.handleDiskContent(event.path, note, disk)
        continue
      }
      if (event.kind === 'renamed') {
        // 目录级重命名/移动:watcher 报不了其下单文件事件,按前缀批量换算
        // folders + notes。判定标准是「严格位于 oldPath 之下」——路径完全相等
        // 是单文件重命名,走下面的文件级分支(标题跟随文件名)。
        const fromNorm = normalizePath(event.oldPath)
        const dirNotes = this.state.notes.filter((n) => normalizePath(n.sourcePath).startsWith(`${fromNorm}/`))
        const dirFolders = this.state.folders.filter((f) => {
          const p = normalizePath(f.path)
          return p === fromNorm || p.startsWith(`${fromNorm}/`)
        })
        if (dirFolders.length > 0 || dirNotes.length > 0) {
          const dirty = dirNotes
            .filter((n) => this.dirtyPaths.has(n.sourcePath))
            .map((n) => ({ id: n.id, newPath: swapPathPrefix(n.sourcePath as string, event.oldPath, event.newPath) as string }))
          dirNotes.forEach((n) => this.cancelPendingWriteBack(n.id))
          this.publish({
            ...this.state,
            folders: this.state.folders.map((f) => {
              const swapped = swapPathPrefix(f.path, event.oldPath, event.newPath)
              return swapped ? { ...f, path: swapped, name: pathBaseName(swapped) } : f
            }),
            notes: this.state.notes.map((n) => {
              const swapped = swapPathPrefix(n.sourcePath, event.oldPath, event.newPath)
              return swapped ? { ...n, sourcePath: swapped } : n
            }),
          })
          for (const item of dirty) this.scheduleWriteBack(item.id, item.newPath)
          continue
        }
        const note = this.noteByPath(event.oldPath)
        if (!note) continue
        const wasDirty = this.dirtyPaths.has(event.oldPath)
        this.cancelPendingWriteBack(note.id)
        const stem = fileNameStem(event.newPath)
        this.publish({
          ...this.state,
          notes: this.state.notes.map((n) => n.id === note.id
            ? { ...n, sourcePath: event.newPath, title: stem || n.title }
            : n),
        })
        if (wasDirty) this.scheduleWriteBack(note.id, event.newPath)
        continue
      }
      // modified:自家写回的回声(内容与上次写回一致)直接忽略
      const note = this.noteByPath(event.path)
      if (!note) {
        // 未知路径 = 外部新建:监听目录内出现的 .md 自动入库(Typora 文件树语义,
        // 树是磁盘的实时视图);自家绑定写回的建文件已先 publish,这里能找到,不会重复入库
        await this.importExternalCreated(event.path)
        continue
      }
      const disk = await this.fileLink.readTextFile(event.path).catch(() => null)
      if (disk === null) continue
      this.handleDiskContent(event.path, note, disk)
    }
  }

  /**
   * 外部新建的笔记文件自动入库(整棵工作区递归监听,树=磁盘实时视图):
   * 仅收工作区根下的笔记扩展名;读取失败(非 UTF-8 等)跳过;标题=文件名。
   */
  private async importExternalCreated(path: string): Promise<void> {
    if (!NOTE_FILE_EXT.test(path)) return
    if (this.noteByPath(path)) return
    const root = this.state.workspaceRoot
    if (!root || !isPathUnder(path, root)) return
    const content = await this.fileLink?.readTextFile(path).catch(() => null)
    if (content == null) return
    this.publish({
      ...this.state,
      notes: [
        this.createNoteRecord(fileNameStem(path) || '新笔记', content, path),
        ...this.state.notes,
      ],
    })
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
    // Windows 路径大小写/分隔符不敏感:比较一律走 isSamePath(项目地图 §5 不变式),
    // 否则 watcher 报来异形路径会被误判成「外部新建」重复入库
    return this.state.notes.find((note) => isSamePath(note.sourcePath, path))
  }

  /** 不变式:笔记所在目录缺文件夹时补建(仅叶子目录,层级由路径前缀派生) */
  private ensureFoldersForBoundNotes(state: NotebookState): NotebookState {
    let folders = state.folders
    let changed = false
    for (const note of state.notes) {
      const dir = noteDirOf(note.sourcePath)
      if (!dir) continue
      if (folders.some((f) => isSamePath(f.path, dir))) continue
      folders = [...folders, { id: crypto.randomUUID(), name: pathBaseName(dir), path: dir, order: folders.length }]
      changed = true
    }
    return changed ? { ...state, folders } : state
  }
}
