import { describe, expect, it, vi } from 'vitest'
import { NotebookController } from './notebook-controller'
import type { NotebookSnapshot } from '../domain/note'
import type { FileLinkGateway, FsChangeEvent } from '@/platform/contracts'
import { isPathUnder } from '@/shared/paths'
import { appEvents } from '@/shared/events/app-events'

class MemoryRepository {
  snapshot: NotebookSnapshot | null = null
  async load() { return this.snapshot }
  async save(snapshot: NotebookSnapshot) { this.snapshot = snapshot }
}

class FakeFileLink implements FileLinkGateway {
  files = new Map<string, string>()
  dirs = new Set<string>()
  writeCalls: Array<[path: string, contents: string]> = []
  /** 模拟写回失败(占用/权限):集合内的路径写入抛错 */
  failWrites = new Set<string>()
  watched: string[][] = []
  private listener: ((events: FsChangeEvent[]) => void) | null = null

  async readTextFile(path: string) {
    if (!this.files.has(path)) throw new Error(`not found: ${path}`)
    return this.files.get(path) as string
  }

  async writeTextFile(path: string, contents: string) {
    if (this.failWrites.has(path)) throw new Error(`被占用: ${path}`)
    this.writeCalls.push([path, contents])
    this.files.set(path, contents)
  }

  async watchPaths(paths: string[]) { this.watched.push(paths) }

  onFsChanges(listener: (events: FsChangeEvent[]) => void) {
    this.listener = listener
    return Promise.resolve(() => { this.listener = null })
  }

  async moveFile(src: string, destDir: string) {
    if (!this.files.has(src)) throw new Error(`not found: ${src}`)
    const name = src.split(/[\\/]/).pop() as string
    const dest = `${destDir.replace(/[\\/]+$/, '')}\\${name}`
    this.files.set(dest, this.files.get(src) as string)
    this.files.delete(src)
    return dest
  }

  async renameFile(src: string, newName: string) {
    if (!this.files.has(src)) throw new Error(`not found: ${src}`)
    const dir = src.slice(0, Math.max(src.lastIndexOf('\\'), src.lastIndexOf('/')))
    const dest = `${dir}\\${newName}`
    if (this.files.has(dest)) throw new Error(`目标已存在: ${dest}`)
    this.files.set(dest, this.files.get(src) as string)
    this.files.delete(src)
    return dest
  }

  trashCalls: string[] = []

  async trashFile(path: string) {
    // 幂等:文件已不在(外部先删)视为成功
    if (!this.files.has(path)) return
    this.files.delete(path)
    this.trashCalls.push(path)
  }

  async renameDirectory(oldPath: string, newPath: string) {
    // 移动目录下所有文件到新前缀,模拟真实 rename
    for (const key of [...this.files.keys()]) {
      if (key.startsWith(oldPath)) {
        this.files.set(`${newPath}${key.slice(oldPath.length)}`, this.files.get(key) as string)
        this.files.delete(key)
      }
    }
    if (this.dirs.delete(oldPath)) this.dirs.add(newPath)
  }

  async deleteDirectory(path: string) {
    // 回收站语义:目录下文件从 fake 磁盘消失
    for (const key of [...this.files.keys()]) {
      if (key.startsWith(`${path}\\`) || key.startsWith(`${path}/`)) this.files.delete(key)
    }
    this.dirs.delete(path)
  }

  async uniqueDestination(dir: string, fileName: string) {
    const base = fileName.replace(/[\\/:*?"<>|]/g, '_')
    if (!this.files.has(`${dir}\\${base}`)) return `${dir}\\${base}`
    const stem = base.replace(/\.[^.]+$/, '')
    const ext = base.slice(stem.length)
    let n = 2
    while (this.files.has(`${dir}\\${stem}-${n}${ext}`)) n++
    return `${dir}\\${stem}-${n}${ext}`
  }

  emit(events: FsChangeEvent[]) { this.listener?.(events) }
}

function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('NotebookController', () => {
  it('creates and updates notes without exposing persistence details', async () => {
    const repository = new MemoryRepository()
    const controller = new NotebookController(repository)
    await controller.hydrate()
    const id = controller.createNote(undefined, '# Architecture')
    controller.updateNote(id, '# Architecture\n\ncontent')
    expect(controller.getSnapshot().notes[0]).toMatchObject({ id, title: 'Architecture' })
    await new Promise((resolve) => setTimeout(resolve, 220))
    expect(repository.snapshot?.notes[0].content).toContain('content')
  })

  it('moves the active selection when the active note is removed', async () => {
    const controller = new NotebookController(new MemoryRepository())
    await controller.hydrate()
    const first = controller.getSnapshot().activeId
    controller.createNote('second')
    controller.removeNote(controller.getSnapshot().activeId as string)
    expect(controller.getSnapshot().activeId).toBe(first)
  })

  describe('file binding (双向同步)', () => {
    it('bindNoteToFile sets sourcePath and writes current content to disk', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\hello.md')
      expect(controller.getSnapshot().notes[0].sourcePath).toBe('C:\\notes\\hello.md')
      expect(fileLink.files.get('C:\\notes\\hello.md')).toBe('# hello')
    })

    it('bindNoteToFile migrates assets into the target dir (库内 → 首绑,来源回落全局根)', async () => {
      const fileLink = new FakeFileLink()
      const migrated: Array<[string | null, string]> = []
      const controller = new NotebookController(
        new MemoryRepository(),
        fileLink,
        async (_content, fromDir, toDir) => { migrated.push([fromDir, toDir]) },
      )
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\hello.md')
      expect(migrated).toEqual([[null, 'C:\\notes']])
    })

    it('write-back of edits is debounced onto the bound file', async () => {
      vi.useFakeTimers()
      try {
        const fileLink = new FakeFileLink()
        const controller = new NotebookController(new MemoryRepository(), fileLink)
        await controller.hydrate()
        const id = controller.createNote(undefined, '# hello')
        await controller.bindNoteToFile(id, 'C:\\notes\\hello.md')
        controller.updateNote(id, '# hello\n\n456')
        await vi.advanceTimersByTimeAsync(600)
        expect(fileLink.files.get('C:\\notes\\hello.md')).toContain('456')
      } finally {
        vi.useRealTimers()
      }
    })

    it('flushNote writes pending edits immediately and setNote switch flushes', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\hello.md')
      controller.updateNote(id, '# hello\n\nflushed')
      controller.flushNote(id)
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\hello.md')).toContain('flushed')
      // 切走再改,切回时上一条应已落盘
      controller.updateNote(id, '# hello\n\nvia-switch')
      controller.setActive(null)
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\hello.md')).toContain('via-switch')
    })

    it('write-back failure emits write-failed once and recovers on success', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const failures: string[] = []
      const off = appEvents.on('write-failed', ({ path }) => failures.push(path))
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
      controller.updateNote(id, '# hello\n\nwill fail')
      fileLink.failWrites.add('C:\\notes\\a.md')
      controller.flushNote(id)
      await flushAsync()
      // 首次失败发事件;dirty 保留,内容仍在内存里(可重试)
      expect(failures).toEqual(['C:\\notes\\a.md'])
      expect(controller.getSnapshot().notes[0].content).toContain('will fail')
      // 重试成功:落盘,且失败标记解除
      fileLink.failWrites.delete('C:\\notes\\a.md')
      controller.flushNote(id)
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\a.md')).toContain('will fail')
      // 再次失败重新报(成功已解除首次标记)
      fileLink.failWrites.add('C:\\notes\\a.md')
      controller.updateNote(id, '# hello\n\nfail again')
      controller.flushNote(id)
      await flushAsync()
      expect(failures).toEqual(['C:\\notes\\a.md', 'C:\\notes\\a.md'])
      off()
    })

    it('external modification reloads content into the clean note', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# old')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
      fileLink.files.set('C:\\notes\\a.md', '# new heading')
      fileLink.emit([{ kind: 'modified', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().notes[0].content).toBe('# new heading')
      // 绑定笔记的标题跟随磁盘文件名,内容变化不再派生标题
      expect(controller.getSnapshot().notes[0].title).toBe('a')
    })

    it('echo of own write-back does not trigger reload', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
      controller.updateNote(id, '# hello\n\necho')
      controller.flushNote(id)
      await flushAsync()
      // 用户随后又继续编辑(状态比磁盘新),watcher 送达自家写回的回声
      controller.updateNote(id, '# hello\n\necho and more')
      fileLink.emit([{ kind: 'modified', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().notes[0].content).toBe('# hello\n\necho and more')
    })

    it('conflict while dirty emits fs-conflict without changing content', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# mine')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
      controller.updateNote(id, '# mine\n\nlocal edit')
      fileLink.files.set('C:\\notes\\a.md', '# theirs')
      fileLink.emit([{ kind: 'modified', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      // 脏状态下的 modified 不直接覆盖内容;处置入口:重载取磁盘版
      expect(controller.getSnapshot().notes[0].content).toBe('# mine\n\nlocal edit')
      await controller.reloadNoteFromDisk(id)
      expect(controller.getSnapshot().notes[0].content).toBe('# theirs')
      // 或:保留本地版本立即写回覆盖磁盘
      controller.updateNote(id, '# mine\n\nlocal edit')
      controller.keepLocalNote(id)
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\a.md')).toBe('# mine\n\nlocal edit')
    })

    it('removed event with file still on disk (own atomic-write echo) does not mark missing', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
      // rename 替换目标文件时 Windows 会报 removed,但文件其实还在且内容是自家写的
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().fileMissingIds.has(id)).toBe(false)
      expect(controller.getSnapshot().notes[0].content).toBe('# hello')
    })

    it('save-as (rebind to a new path) clears the missing flag and writes the new file', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
      // 未写回编辑 + 文件消失 = 失联(干净笔记会被直接移除)
      controller.updateNote(id, '# hello\n\ndirty')
      fileLink.files.delete('C:\\notes\\a.md')
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().fileMissingIds.has(id)).toBe(true)
      controller.updateNote(id, '# hello\n\nrelocated')
      await controller.bindNoteToFile(id, 'C:\\elsewhere\\b.md')
      expect(controller.getSnapshot().fileMissingIds.has(id)).toBe(false)
      expect(controller.getSnapshot().notes[0].sourcePath).toBe('C:\\elsewhere\\b.md')
      expect(fileLink.files.get('C:\\elsewhere\\b.md')).toContain('relocated')
    })

    it('removing a missing note clears its missing flag', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello', 'C:\\notes\\a.md')
      // 未写回编辑 + 文件消失才会标失联(干净笔记的外部删除直接移除)
      controller.updateNote(id, '# hello\n\ndirty')
      fileLink.files.delete('C:\\notes\\a.md')
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().fileMissingIds.has(id)).toBe(true)
      await controller.removeNote(id)
      expect(controller.getSnapshot().fileMissingIds.has(id)).toBe(false)
    })

    it('external removal of a dirty note marks it missing and write-back recreates the file', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
      controller.updateNote(id, '# hello\n\nunsaved')
      fileLink.files.delete('C:\\notes\\a.md')
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().fileMissingIds.has(id)).toBe(true)
      controller.updateNote(id, '# hello\n\nrecreate')
      controller.flushNote(id)
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\a.md')).toContain('recreate')
      expect(controller.getSnapshot().fileMissingIds.has(id)).toBe(false)
    })

    it('external removal of a clean note removes it from the list (tree = disk)', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
      fileLink.files.delete('C:\\notes\\a.md')
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      // Typora 语义:树是磁盘的实时视图,文件没了笔记就消失(文件在回收站可恢复)
      expect(controller.getSnapshot().notes.some((n) => n.id === id)).toBe(false)
      expect(controller.getSnapshot().fileMissingIds.has(id)).toBe(false)
    })

    it('external created md in a watched dir auto-imports as a bound note', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# anchor')
      await controller.bindNoteToFile(id, 'C:\\notes\\anchor.md')
      // 同目录外部新建(Explorer 里建文件):modified 事件 + 未知路径 → 自动入库
      fileLink.files.set('C:\\notes\\dropped.md', '# dropped')
      fileLink.emit([{ kind: 'modified', path: 'C:\\notes\\dropped.md' }])
      await flushAsync()
      const imported = controller.getSnapshot().notes.find((n) => n.sourcePath === 'C:\\notes\\dropped.md')
      expect(imported?.title).toBe('dropped')
      expect(imported?.content).toBe('# dropped')
      // 非监听目录(无绑定笔记)的文件不收
      fileLink.files.set('C:\\elsewhere\\x.md', '# x')
      fileLink.emit([{ kind: 'modified', path: 'C:\\elsewhere\\x.md' }])
      await flushAsync()
      expect(controller.getSnapshot().notes.some((n) => n.sourcePath === 'C:\\elsewhere\\x.md')).toBe(false)
    })

    it('external rename rebinds path and retitles non-custom notes', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# old')
      await controller.bindNoteToFile(id, 'C:\\notes\\old.md')
      // 真实磁盘 rename 会把文件移走,fake 磁盘同步模拟
      fileLink.files.set('C:\\notes\\renamed.md', fileLink.files.get('C:\\notes\\old.md') as string)
      fileLink.files.delete('C:\\notes\\old.md')
      fileLink.emit([{ kind: 'renamed', oldPath: 'C:\\notes\\old.md', newPath: 'C:\\notes\\renamed.md' }])
      await flushAsync()
      expect(controller.getSnapshot().notes[0].sourcePath).toBe('C:\\notes\\renamed.md')
      expect(controller.getSnapshot().notes[0].title).toBe('renamed')
      // 改绑后写回应落新路径,旧路径作废
      controller.updateNote(id, '# old\n\nafter rename')
      controller.flushNote(id)
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\renamed.md')).toContain('after rename')
      expect(fileLink.files.has('C:\\notes\\old.md')).toBe(false)
    })

    it('removing a bound note discards pending write-back', async () => {
      vi.useFakeTimers()
      try {
        const fileLink = new FakeFileLink()
        const controller = new NotebookController(new MemoryRepository(), fileLink)
        await controller.hydrate()
        const id = controller.createNote(undefined, '# hello')
        await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
        controller.updateNote(id, '# hello\n\ndoomed')
        await controller.removeNote(id)
        await vi.advanceTimersByTimeAsync(700)
        // 删除 = 文件移入回收站(Typora 语义),未写回的编辑随之放弃
        expect(fileLink.trashCalls).toEqual(['C:\\notes\\a.md'])
        expect(fileLink.files.has('C:\\notes\\a.md')).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('syncs bound paths to the watcher as notes change', async () => {
      vi.useFakeTimers()
      try {
        const fileLink = new FakeFileLink()
        const controller = new NotebookController(new MemoryRepository(), fileLink)
        await controller.hydrate()
        const id = controller.createNote(undefined, '# hello', 'C:\\notes\\a.md')
        await vi.advanceTimersByTimeAsync(600)
        expect(fileLink.watched.at(-1)).toContain('C:\\notes\\a.md')
        await controller.removeNote(id)
        await vi.advanceTimersByTimeAsync(600)
        expect(fileLink.watched.at(-1)).not.toContain('C:\\notes\\a.md')
      } finally {
        vi.useRealTimers()
      }
    })

    it('v1 legacy snapshot hydrates and keeps working', async () => {
      const repository = new MemoryRepository()
      repository.snapshot = {
        schemaVersion: 1,
        notes: [{ id: 'legacy', title: 'legacy', content: '# legacy', updatedAt: 1 }],
        folders: [],
      } as unknown as NotebookSnapshot
      const controller = new NotebookController(repository)
      await controller.hydrate()
      expect(controller.getSnapshot().notes[0].id).toBe('legacy')
      controller.updateNote('legacy', '# legacy\n\nedited')
      await new Promise((resolve) => setTimeout(resolve, 220))
      expect(repository.snapshot?.schemaVersion).toBe(3)
    })

    it('v2 snapshot migrates: legacy folders dropped, groups rebuilt from bound note dirs', async () => {
      const repository = new MemoryRepository()
      repository.snapshot = {
        schemaVersion: 2,
        notes: [
          { id: 'a', title: 'a', content: '', updatedAt: 1, sourcePath: 'C:\\lib\\docs\\a.md' },
          { id: 'b', title: 'b', content: '', updatedAt: 1, sourcePath: 'C:\\lib\\docs\\b.md' },
          { id: 'c', title: 'c', content: '', updatedAt: 1, sourcePath: 'C:\\lib\\other\\c.md' },
          { id: 'd', title: 'd', content: '', updatedAt: 1, folderId: 'old-group' },
        ],
        folders: [{ id: 'old-group', name: '旧文件夹', order: 0 }],
      } as unknown as NotebookSnapshot
      const controller = new NotebookController(repository)
      await controller.hydrate()
      const state = controller.getSnapshot()
      expect(state.schemaVersion).toBe(3)
      expect(state.notes.every((n) => !('folderId' in n))).toBe(true)
      expect(state.folders.map((f) => f.name).sort()).toEqual(['docs', 'other'])
      expect(state.folders.every((f) => f.path.length > 0)).toBe(true)
    })

    it('every bound note dir gets a folder entity (derived-group invariant)', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      controller.createNote(undefined, '# hello', 'C:\\deep\\nested\\dir\\a.md')
      const folder = controller.getSnapshot().folders.find((f) => f.path === 'C:\\deep\\nested\\dir')
      expect(folder?.name).toBe('dir')
    })

    it('moveNoteToFolder physically moves the file and rebinds, migrating assets', async () => {
      const fileLink = new FakeFileLink()
      const migrated: Array<[string, string | null, string]> = []
      const controller = new NotebookController(
        new MemoryRepository(),
        fileLink,
        async (content, fromDir, toDir) => { migrated.push([content, fromDir, toDir]) },
      )
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello', 'C:\\from\\a.md')
      // 绑定笔记的磁盘文件真实存在(fake 磁盘预置;应用内来自导入/绑定写盘)
      fileLink.files.set('C:\\from\\a.md', '# hello')
      await controller.moveNoteToFolder(id, controller.createFolder('C:\\to'))
      const note = controller.getSnapshot().notes.find((n) => n.id === id)
      expect(note?.sourcePath).toBe('C:\\to\\a.md')
      expect(migrated).toEqual([['# hello', 'C:\\from', 'C:\\to']])
      expect(fileLink.files.has('C:\\to\\a.md')).toBe(true)
      expect(fileLink.files.has('C:\\from\\a.md')).toBe(false)
    })

    it('moving an unbound note into a folder binds it to a unique path', async () => {
      const fileLink = new FakeFileLink()
      fileLink.files.set('C:\\to\\新笔记.md', '别人的文件')
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote('我的笔记', '# mine')
      const folderId = controller.createFolder('C:\\to')
      await controller.moveNoteToFolder(id, folderId)
      const note = controller.getSnapshot().notes.find((n) => n.id === id)
      expect(note?.sourcePath).toBe('C:\\to\\我的笔记.md')
      expect(fileLink.files.get('C:\\to\\我的笔记.md')).toBe('# mine')
    })

    it('moving an unbound note migrates assets on bind (移动即绑定,来源回落全局根)', async () => {
      const fileLink = new FakeFileLink()
      const migrated: Array<[string | null, string]> = []
      const controller = new NotebookController(
        new MemoryRepository(),
        fileLink,
        async (_content, fromDir, toDir) => { migrated.push([fromDir, toDir]) },
      )
      await controller.hydrate()
      const id = controller.createNote('我的笔记', '# mine')
      await controller.moveNoteToFolder(id, controller.createFolder('C:\\to'))
      expect(migrated).toEqual([[null, 'C:\\to']])
    })

    it('moving a dirty note preserves unsaved edits (immediately written to the new path)', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello', 'C:\\from\\a.md')
      fileLink.files.set('C:\\from\\a.md', '# hello')
      controller.updateNote(id, '# hello\n\nunsaved')
      await controller.moveNoteToFolder(id, controller.createFolder('C:\\to'))
      await flushAsync()
      const note = controller.getSnapshot().notes.find((n) => n.id === id)
      expect(note?.sourcePath).toBe('C:\\to\\a.md')
      // 未写回的编辑随笔记走,不被磁盘旧版覆盖;旧路径文件已移走
      expect(fileLink.files.get('C:\\to\\a.md')).toBe('# hello\n\nunsaved')
      expect(fileLink.files.has('C:\\from\\a.md')).toBe(false)
    })

    it('renameFolder renames the disk dir and prefix-swaps nested notes', async () => {
      vi.useFakeTimers()
      try {
        const fileLink = new FakeFileLink()
        const controller = new NotebookController(new MemoryRepository(), fileLink)
        await controller.hydrate()
        const id = controller.createNote(undefined, '# hello', 'C:\\old-name\\sub\\a.md')
        const folderId = controller.createFolder('C:\\old-name')
        await controller.renameFolder(folderId, 'new-name')
        const note = controller.getSnapshot().notes.find((n) => n.id === id)
        expect(note?.sourcePath).toBe('C:\\new-name\\sub\\a.md')
        expect(controller.getSnapshot().folders.find((f) => f.id === folderId)?.path).toBe('C:\\new-name')
        // 子目录不存在的脏笔记:rename 本身不动文件内容,无 dirty 时不补写
        expect(fileLink.files.has('C:\\new-name\\sub\\a.md')).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('directory-level renamed event swaps folder and note prefixes', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      controller.createNote(undefined, '# hello', 'C:\\before\\a.md')
      controller.createNote(undefined, '# other', 'C:\\before\\sub\\b.md')
      controller.createFolder('C:\\before')
      fileLink.files.set('C:\\before\\a.md', '# hello')
      fileLink.files.set('C:\\before\\sub\\b.md', '# other')
      fileLink.emit([{ kind: 'renamed', oldPath: 'C:\\before', newPath: 'C:\\after' }])
      await flushAsync()
      const state = controller.getSnapshot()
      expect(state.notes.find((n) => n.title === 'hello')?.sourcePath).toBe('C:\\after\\a.md')
      expect(state.notes.find((n) => n.title === 'other')?.sourcePath).toBe('C:\\after\\sub\\b.md')
      expect(state.folders.find((f) => f.path === 'C:\\after')).toBeDefined()
    })

    it('removeFolder deletes the disk dir and removes nested notes and subfolders', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      controller.createNote(undefined, '# inner', 'C:\\doom\\a.md')
      controller.createNote(undefined, '# nested', 'C:\\doom\\sub\\b.md')
      controller.createNote(undefined, '# safe', 'C:\\elsewhere\\c.md')
      controller.createFolder('C:\\doom')
      // fake 磁盘预置真实文件(createNote 不写盘,应用内来自导入/绑定)
      fileLink.files.set('C:\\doom\\a.md', '# inner')
      fileLink.files.set('C:\\doom\\sub\\b.md', '# nested')
      fileLink.files.set('C:\\elsewhere\\c.md', '# safe')
      await controller.removeFolder(controller.getSnapshot().folders[0].id)
      const state = controller.getSnapshot()
      // 目录删除(回收站) → 其中笔记与子文件夹一并移除;目录外的笔记不受影响
      expect(state.notes.find((n) => n.title === 'inner')).toBeUndefined()
      expect(state.notes.find((n) => n.title === 'nested')).toBeUndefined()
      expect(state.notes.find((n) => n.title === 'safe')).toBeDefined()
      expect(state.folders.some((f) => isPathUnder(f.path, 'C:\\doom'))).toBe(false)
      expect(fileLink.files.has('C:\\doom\\a.md')).toBe(false)
      expect(fileLink.files.has('C:\\elsewhere\\c.md')).toBe(true)
    })
  })
})
