import { describe, expect, it, vi } from 'vitest'
import { NotebookController } from './notebook-controller'
import type { NotebookSnapshot } from '../domain/note'
import type { FileLinkGateway, FsChangeEvent } from '@/platform/contracts'

class MemoryRepository {
  snapshot: NotebookSnapshot | null = null
  async load() { return this.snapshot }
  async save(snapshot: NotebookSnapshot) { this.snapshot = snapshot }
}

class FakeFileLink implements FileLinkGateway {
  files = new Map<string, string>()
  writeCalls: Array<[path: string, contents: string]> = []
  watched: string[][] = []
  private listener: ((events: FsChangeEvent[]) => void) | null = null

  async readTextFile(path: string) {
    if (!this.files.has(path)) throw new Error(`not found: ${path}`)
    return this.files.get(path) as string
  }

  async writeTextFile(path: string, contents: string) {
    this.writeCalls.push([path, contents])
    this.files.set(path, contents)
  }

  async watchPaths(paths: string[]) { this.watched.push(paths) }

  onFsChanges(listener: (events: FsChangeEvent[]) => void) {
    this.listener = listener
    return Promise.resolve(() => { this.listener = null })
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
      expect(controller.getSnapshot().notes[0].title).toBe('new heading')
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

    it('external removal marks the note missing and write-back recreates the file', async () => {
      const fileLink = new FakeFileLink()
      const controller = new NotebookController(new MemoryRepository(), fileLink)
      await controller.hydrate()
      const id = controller.createNote(undefined, '# hello')
      await controller.bindNoteToFile(id, 'C:\\notes\\a.md')
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
        controller.removeNote(id)
        await vi.advanceTimersByTimeAsync(700)
        expect(fileLink.files.get('C:\\notes\\a.md')).toBe('# hello')
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
        controller.removeNote(id)
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
      expect(repository.snapshot?.schemaVersion).toBe(2)
    })
  })
})
