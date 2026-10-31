import { describe, expect, it, vi } from 'vitest'
import { NotebookController } from './notebook-controller'
import type { NotebookSnapshot, Note } from '../domain/note'
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
  /** 最近一次 watchWorkspace 调用(工作区递归监听同步) */
  watchedRoot: string | null | undefined
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

  /** 模拟 Rust read_folder_notes:递归返回 fake 磁盘上 root 之下的笔记文件 */
  async readFolderNotes(root: string) {
    const out: Array<{ folderPath: string; title: string; content: string; filePath: string }> = []
    for (const [path, content] of this.files) {
      if (!path.startsWith(`${root}\\`)) continue
      if (!/\.(md|markdown|txt)$/i.test(path)) continue
      out.push({
        folderPath: '',
        title: (path.split('\\').pop() ?? '').replace(/\.(md|markdown|txt)$/i, ''),
        content,
        filePath: path,
      })
    }
    return out
  }

  async watchWorkspace(root: string | null) { this.watchedRoot = root }

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

/** v4 造数:预置工作区笔记(快照水合,模拟重开工作区后的状态) */
function note(id: string, sourcePath: string, content = '', title?: string): Note {
  return { id, title: title ?? sourcePath.split(/[\\/]/).pop()!.replace(/\.(md|markdown|txt)$/i, ''), content, updatedAt: 1, sourcePath }
}

async function controllerWithNotes(fileLink: FakeFileLink, notes: Note[], repository = new MemoryRepository()): Promise<NotebookController> {
  repository.snapshot = { schemaVersion: 4, notes, folders: [] }
  const controller = new NotebookController(repository, fileLink)
  await controller.hydrate()
  return controller
}

describe('NotebookController', () => {
  it('createNoteInDir writes a unique file to disk and binds it', async () => {
    vi.useFakeTimers()
    try {
      const fileLink = new FakeFileLink()
      const repository = new MemoryRepository()
      const controller = new NotebookController(repository, fileLink)
      await controller.hydrate()
      fileLink.files.set('C:\\notes\\新笔记.md', '别人的文件')
      const id = await controller.createNoteInDir('C:\\notes')
      const note = controller.getSnapshot().notes.find((n) => n.id === id)
      expect(note?.sourcePath).toBe('C:\\notes\\新笔记-2.md')
      expect(fileLink.files.get('C:\\notes\\新笔记-2.md')).toBe('')
      // 编辑写回防抖落盘
      controller.updateNote(id, '# Architecture\n\ncontent')
      await vi.advanceTimersByTimeAsync(600)
      expect(fileLink.files.get('C:\\notes\\新笔记-2.md')).toContain('content')
    } finally {
      vi.useRealTimers()
    }
  })

  it('moves the active selection when the active note is removed', async () => {
    const fileLink = new FakeFileLink()
    const controller = await controllerWithNotes(fileLink, [
      note('a', 'C:\\notes\\a.md'),
      note('b', 'C:\\notes\\b.md'),
    ])
    controller.setActive('a')
    await controller.removeNote('a')
    expect(controller.getSnapshot().activeId).toBe('b')
  })

  describe('workspace (folder-first)', () => {
    it('openWorkspace imports the folder tree, rebuilds folders and starts recursive watching', async () => {
      const fileLink = new FakeFileLink()
      fileLink.files.set('C:\\ws\\a.md', '# a')
      fileLink.files.set('C:\\ws\\sub\\b.md', '# b')
      fileLink.files.set('C:\\ws\\assets\\c.png', 'binary not a note')
      const repository = new MemoryRepository()
      const controller = new NotebookController(repository, fileLink)
      await controller.hydrate()
      await controller.openWorkspace('C:\\ws\\')
      const state = controller.getSnapshot()
      // 目录尾分隔符被规范化;仅笔记扩展名入库
      expect(state.workspaceRoot).toBe('C:\\ws')
      expect(state.notes.map((n) => n.title).sort()).toEqual(['a', 'b'])
      expect(state.notes.every((n) => n.sourcePath.startsWith('C:\\ws'))).toBe(true)
      expect(state.folders.map((f) => f.name).sort()).toEqual(['sub', 'ws'])
      expect(fileLink.watchedRoot).toBe('C:\\ws')
      // 重开同一工作区:同路径笔记复用(id/主题跟随,重扫不丢绑定态)
      const idsBefore = state.notes.map((n) => [n.sourcePath, n.id] as const)
      await controller.openWorkspace('C:\\ws')
      const reopened = controller.getSnapshot().notes
      expect(reopened.map((n) => [n.sourcePath, n.id])).toEqual(idsBefore)
    })

    it('closeWorkspace stops watching and clears the list', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\ws\\a.md')])
      await controller.openWorkspace('C:\\ws')
      await controller.closeWorkspace()
      expect(controller.getSnapshot().workspaceRoot).toBeNull()
      expect(controller.getSnapshot().notes).toEqual([])
      expect(fileLink.watchedRoot).toBeNull()
    })

    it('external created md anywhere under the workspace auto-imports (tree = disk)', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('anchor', 'C:\\ws\\notes\\anchor.md')])
      await controller.openWorkspace('C:\\ws')
      fileLink.files.set('C:\\ws\\dropped.md', '# dropped')
      fileLink.emit([{ kind: 'modified', path: 'C:\\ws\\dropped.md' }])
      await flushAsync()
      const imported = controller.getSnapshot().notes.find((n) => n.sourcePath === 'C:\\ws\\dropped.md')
      expect(imported?.title).toBe('dropped')
      expect(imported?.content).toBe('# dropped')
      // 工作区外的路径不收
      fileLink.files.set('C:\\elsewhere\\x.md', '# x')
      fileLink.emit([{ kind: 'modified', path: 'C:\\elsewhere\\x.md' }])
      await flushAsync()
      expect(controller.getSnapshot().notes.some((n) => n.sourcePath === 'C:\\elsewhere\\x.md')).toBe(false)
    })

    it('v3 legacy snapshot hydrates: unbound notes dropped, bound notes kept, schema bumps to 4', async () => {
      const repository = new MemoryRepository()
      repository.snapshot = {
        schemaVersion: 3,
        notes: [
          { id: 'bound', title: 'bound', content: '# bound', updatedAt: 1, sourcePath: 'C:\\ws\\a.md' },
          { id: 'library', title: '库内旧笔记', content: '# gone', updatedAt: 1 },
        ],
        folders: [],
      } as unknown as NotebookSnapshot
      const controller = new NotebookController(repository)
      await controller.hydrate()
      const state = controller.getSnapshot()
      expect(state.schemaVersion).toBe(4)
      expect(state.notes.map((n) => n.id)).toEqual(['bound'])
      controller.updateNote('bound', '# bound\n\nedited')
      await new Promise((resolve) => setTimeout(resolve, 220))
      expect(repository.snapshot?.schemaVersion).toBe(4)
    })

    it('every bound note dir gets a folder entity (derived-group invariant)', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\deep\\nested\\dir\\a.md')])
      controller.setActive('a')
      const folder = controller.getSnapshot().folders.find((f) => f.path === 'C:\\deep\\nested\\dir')
      expect(folder?.name).toBe('dir')
    })
  })

  describe('file binding (双向同步)', () => {
    it('bindNoteToFile sets sourcePath and writes current content to disk', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
      await controller.bindNoteToFile('a', 'C:\\notes\\hello.md')
      expect(controller.getSnapshot().notes[0].sourcePath).toBe('C:\\notes\\hello.md')
      expect(fileLink.files.get('C:\\notes\\hello.md')).toBe('# hello')
    })

    it('write-back failure emits write-failed once and recovers on success', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
      const failures: string[] = []
      const off = appEvents.on('write-failed', ({ path }) => failures.push(path))
      controller.updateNote('a', '# hello\n\nwill fail')
      fileLink.failWrites.add('C:\\notes\\a.md')
      controller.flushNote('a')
      await flushAsync()
      // 首次失败发事件;dirty 保留,内容仍在内存里(可重试)
      expect(failures).toEqual(['C:\\notes\\a.md'])
      expect(controller.getSnapshot().notes[0].content).toContain('will fail')
      // 重试成功:落盘,且失败标记解除
      fileLink.failWrites.delete('C:\\notes\\a.md')
      controller.flushNote('a')
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\a.md')).toContain('will fail')
      // 再次失败重新报(成功已解除首次标记)
      fileLink.failWrites.add('C:\\notes\\a.md')
      controller.updateNote('a', '# hello\n\nfail again')
      controller.flushNote('a')
      await flushAsync()
      expect(failures).toEqual(['C:\\notes\\a.md', 'C:\\notes\\a.md'])
      off()
    })

    it('external modification reloads content into the clean note', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# old')])
      fileLink.files.set('C:\\notes\\a.md', '# new heading')
      fileLink.emit([{ kind: 'modified', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().notes[0].content).toBe('# new heading')
      // 绑定笔记的标题跟随磁盘文件名,内容变化不再派生标题
      expect(controller.getSnapshot().notes[0].title).toBe('a')
    })

    it('echo of own write-back does not trigger reload', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
      controller.updateNote('a', '# hello\n\necho')
      controller.flushNote('a')
      await flushAsync()
      // 用户随后又继续编辑(状态比磁盘新),watcher 送达自家写回的回声
      controller.updateNote('a', '# hello\n\necho and more')
      fileLink.emit([{ kind: 'modified', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().notes[0].content).toBe('# hello\n\necho and more')
    })

    it('conflict while dirty emits fs-conflict without changing content', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# mine')])
      controller.updateNote('a', '# mine\n\nlocal edit')
      fileLink.files.set('C:\\notes\\a.md', '# theirs')
      fileLink.emit([{ kind: 'modified', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      // 脏状态下的 modified 不直接覆盖内容;处置入口:重载取磁盘版
      expect(controller.getSnapshot().notes[0].content).toBe('# mine\n\nlocal edit')
      await controller.reloadNoteFromDisk('a')
      expect(controller.getSnapshot().notes[0].content).toBe('# theirs')
      // 或:保留本地版本立即写回覆盖磁盘
      controller.updateNote('a', '# mine\n\nlocal edit')
      controller.keepLocalNote('a')
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\a.md')).toBe('# mine\n\nlocal edit')
    })

    it('removed event with file still on disk (own atomic-write echo) does not mark missing', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
      fileLink.files.set('C:\\notes\\a.md', '# hello')
      // rename 替换目标文件时 Windows 会报 removed,但文件其实还在且内容是自家写的
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().fileMissingIds.has('a')).toBe(false)
      expect(controller.getSnapshot().notes[0].content).toBe('# hello')
    })

    it('save-as (rebind to a new path) clears the missing flag and writes the new file', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
      // 未写回编辑 + 文件消失 = 失联(干净笔记会被直接移除)
      controller.updateNote('a', '# hello\n\ndirty')
      fileLink.files.delete('C:\\notes\\a.md')
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().fileMissingIds.has('a')).toBe(true)
      controller.updateNote('a', '# hello\n\nrelocated')
      await controller.bindNoteToFile('a', 'C:\\elsewhere\\b.md')
      expect(controller.getSnapshot().fileMissingIds.has('a')).toBe(false)
      expect(controller.getSnapshot().notes[0].sourcePath).toBe('C:\\elsewhere\\b.md')
      expect(fileLink.files.get('C:\\elsewhere\\b.md')).toContain('relocated')
    })

    it('removing a missing note clears its missing flag', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
      // 未写回编辑 + 文件消失才会标失联(干净笔记的外部删除直接移除)
      controller.updateNote('a', '# hello\n\ndirty')
      fileLink.files.delete('C:\\notes\\a.md')
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().fileMissingIds.has('a')).toBe(true)
      await controller.removeNote('a')
      expect(controller.getSnapshot().fileMissingIds.has('a')).toBe(false)
    })

    it('external removal of a dirty note marks it missing and write-back recreates the file', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
      controller.updateNote('a', '# hello\n\nunsaved')
      fileLink.files.delete('C:\\notes\\a.md')
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      expect(controller.getSnapshot().fileMissingIds.has('a')).toBe(true)
      controller.updateNote('a', '# hello\n\nrecreate')
      controller.flushNote('a')
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\a.md')).toContain('recreate')
      expect(controller.getSnapshot().fileMissingIds.has('a')).toBe(false)
    })

    it('external removal of a clean note removes it from the list (tree = disk)', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
      fileLink.files.delete('C:\\notes\\a.md')
      fileLink.emit([{ kind: 'removed', path: 'C:\\notes\\a.md' }])
      await flushAsync()
      // Typora 语义:树是磁盘的实时视图,文件没了笔记就消失(文件在回收站可恢复)
      expect(controller.getSnapshot().notes.some((n) => n.id === 'a')).toBe(false)
      expect(controller.getSnapshot().fileMissingIds.has('a')).toBe(false)
    })

    it('external rename rebinds path and retitles notes', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\old.md', '# old')])
      // 真实磁盘 rename 会把文件移走,fake 磁盘同步模拟
      fileLink.files.set('C:\\notes\\renamed.md', fileLink.files.get('C:\\notes\\old.md') as string)
      fileLink.files.delete('C:\\notes\\old.md')
      fileLink.emit([{ kind: 'renamed', oldPath: 'C:\\notes\\old.md', newPath: 'C:\\notes\\renamed.md' }])
      await flushAsync()
      expect(controller.getSnapshot().notes[0].sourcePath).toBe('C:\\notes\\renamed.md')
      expect(controller.getSnapshot().notes[0].title).toBe('renamed')
      // 改绑后写回应落新路径,旧路径作废
      controller.updateNote('a', '# old\n\nafter rename')
      controller.flushNote('a')
      await flushAsync()
      expect(fileLink.files.get('C:\\notes\\renamed.md')).toContain('after rename')
      expect(fileLink.files.has('C:\\notes\\old.md')).toBe(false)
    })

    it('removing a bound note discards pending write-back', async () => {
      vi.useFakeTimers()
      try {
        const fileLink = new FakeFileLink()
        const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\notes\\a.md', '# hello')])
        fileLink.files.set('C:\\notes\\a.md', '# hello')
        controller.updateNote('a', '# hello\n\ndoomed')
        await controller.removeNote('a')
        await vi.advanceTimersByTimeAsync(700)
        // 删除 = 文件移入回收站(Typora 语义),未写回的编辑随之放弃
        expect(fileLink.trashCalls).toEqual(['C:\\notes\\a.md'])
        expect(fileLink.files.has('C:\\notes\\a.md')).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('moveNoteToFolder physically moves the file and rebinds, migrating assets', async () => {
      const fileLink = new FakeFileLink()
      const migrated: Array<[string, string | null, string]> = []
      const repository = new MemoryRepository()
      repository.snapshot = { schemaVersion: 4, notes: [note('a', 'C:\\from\\a.md', '# hello')], folders: [] }
      const controller = new NotebookController(
        repository,
        fileLink,
        async (content, fromDir, toDir) => { migrated.push([content, fromDir, toDir]) },
      )
      await controller.hydrate()
      fileLink.files.set('C:\\from\\a.md', '# hello')
      await controller.moveNoteToFolder('a', controller.createFolder('C:\\to'))
      const moved = controller.getSnapshot().notes.find((n) => n.id === 'a')
      expect(moved?.sourcePath).toBe('C:\\to\\a.md')
      expect(migrated).toEqual([['# hello', 'C:\\from', 'C:\\to']])
      expect(fileLink.files.has('C:\\to\\a.md')).toBe(true)
      expect(fileLink.files.has('C:\\from\\a.md')).toBe(false)
    })

    it('moving a dirty note preserves unsaved edits (immediately written to the new path)', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\from\\a.md', '# hello')])
      fileLink.files.set('C:\\from\\a.md', '# hello')
      controller.updateNote('a', '# hello\n\nunsaved')
      await controller.moveNoteToFolder('a', controller.createFolder('C:\\to'))
      await flushAsync()
      const moved = controller.getSnapshot().notes.find((n) => n.id === 'a')
      expect(moved?.sourcePath).toBe('C:\\to\\a.md')
      // 未写回的编辑随笔记走,不被磁盘旧版覆盖;旧路径文件已移走
      expect(fileLink.files.get('C:\\to\\a.md')).toBe('# hello\n\nunsaved')
      expect(fileLink.files.has('C:\\from\\a.md')).toBe(false)
    })

    it('renameFolder renames the disk dir and prefix-swaps nested notes', async () => {
      vi.useFakeTimers()
      try {
        const fileLink = new FakeFileLink()
        const controller = await controllerWithNotes(fileLink, [note('a', 'C:\\old-name\\sub\\a.md', '# hello')])
        const folderId = controller.createFolder('C:\\old-name')
        await controller.renameFolder(folderId, 'new-name')
        const renamed = controller.getSnapshot().notes.find((n) => n.id === 'a')
        expect(renamed?.sourcePath).toBe('C:\\new-name\\sub\\a.md')
        expect(controller.getSnapshot().folders.find((f) => f.id === folderId)?.path).toBe('C:\\new-name')
        // 子目录不存在的脏笔记:rename 本身不动文件内容,无 dirty 时不补写
        expect(fileLink.files.has('C:\\new-name\\sub\\a.md')).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('directory-level renamed event swaps folder and note prefixes', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [
        note('a', 'C:\\before\\a.md', '# hello'),
        note('b', 'C:\\before\\sub\\b.md', '# other'),
      ])
      controller.createFolder('C:\\before')
      fileLink.files.set('C:\\before\\a.md', '# hello')
      fileLink.files.set('C:\\before\\sub\\b.md', '# other')
      fileLink.emit([{ kind: 'renamed', oldPath: 'C:\\before', newPath: 'C:\\after' }])
      await flushAsync()
      const state = controller.getSnapshot()
      expect(state.notes.find((n) => n.id === 'a')?.sourcePath).toBe('C:\\after\\a.md')
      expect(state.notes.find((n) => n.id === 'b')?.sourcePath).toBe('C:\\after\\sub\\b.md')
      expect(state.folders.find((f) => f.path === 'C:\\after')).toBeDefined()
    })

    it('removeFolder deletes the disk dir and removes nested notes and subfolders', async () => {
      const fileLink = new FakeFileLink()
      const controller = await controllerWithNotes(fileLink, [
        note('a', 'C:\\doom\\a.md', '# inner'),
        note('b', 'C:\\doom\\sub\\b.md', '# nested'),
        note('c', 'C:\\elsewhere\\c.md', '# safe'),
      ])
      controller.createFolder('C:\\doom')
      // fake 磁盘预置真实文件(模拟已落盘)
      fileLink.files.set('C:\\doom\\a.md', '# inner')
      fileLink.files.set('C:\\doom\\sub\\b.md', '# nested')
      fileLink.files.set('C:\\elsewhere\\c.md', '# safe')
      await controller.removeFolder(controller.getSnapshot().folders[0].id)
      const state = controller.getSnapshot()
      // 目录删除(回收站) → 其中笔记与子文件夹一并移除;目录外的笔记不受影响
      expect(state.notes.find((n) => n.id === 'a')).toBeUndefined()
      expect(state.notes.find((n) => n.id === 'b')).toBeUndefined()
      expect(state.notes.find((n) => n.id === 'c')).toBeDefined()
      expect(state.folders.some((f) => isPathUnder(f.path, 'C:\\doom'))).toBe(false)
      expect(fileLink.files.has('C:\\doom\\a.md')).toBe(false)
      expect(fileLink.files.has('C:\\elsewhere\\c.md')).toBe(true)
    })
  })
})
