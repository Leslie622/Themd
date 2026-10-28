import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  ChevronRight,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  FolderUp,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { readFiles, readFolder } from '@/lib/files'
import { fromNow } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useNotebook } from '@/store'
import type { Note } from '@/store'

export function Sidebar() {
  const notes = useNotebook((s) => s.notes)
  const folders = useNotebook((s) => s.folders)
  const activeId = useNotebook((s) => s.activeId)
  const setActive = useNotebook((s) => s.setActive)
  const createNote = useNotebook((s) => s.createNote)
  const renameNote = useNotebook((s) => s.renameNote)
  const removeNote = useNotebook((s) => s.removeNote)
  const createFolder = useNotebook((s) => s.createFolder)
  const renameFolder = useNotebook((s) => s.renameFolder)
  const removeFolder = useNotebook((s) => s.removeFolder)
  const setNoteFolder = useNotebook((s) => s.setNoteFolder)

  const [keyword, setKeyword] = useState('')
  const [renaming, setRenaming] = useState<
    { kind: 'note' | 'folder'; id: string; value: string } | null
  >(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const kw = keyword.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      notes.filter(
        (n) =>
          !kw ||
          n.title.toLowerCase().includes(kw) ||
          n.content.toLowerCase().includes(kw),
      ),
    [notes, kw],
  )
  const byFolder = useMemo(() => {
    const map = new Map<string, Note[]>()
    for (const n of filtered) {
      const key = n.folderId ?? ''
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    }
    return map
  }, [filtered])

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const imported = await readFiles(files)
    for (const f of imported) createNote(f.title, f.content)
    e.target.value = '' // 允许再次导入同名文件
  }

  /** 导入文件夹:目录路径 → 自动建分组 */
  async function handleFolderImport(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const imported = await readFolder(files)
    const pathToId = new Map<string, string>()
    for (const f of imported) {
      let folderId: string | undefined
      if (f.folderPath) {
        folderId = pathToId.get(f.folderPath)
        if (!folderId) {
          folderId = createFolder(f.folderPath.split('/').pop() || f.folderPath)
          pathToId.set(f.folderPath, folderId)
        }
      }
      const id = createNote(f.title, f.content)
      if (folderId) setNoteFolder(id, folderId)
    }
    e.target.value = ''
  }

  /** 新建分组:建完立即进入内联重命名 */
  const handleCreateFolder = () => {
    const id = createFolder('新建分组')
    setRenaming({ kind: 'folder', id, value: '新建分组' })
  }

  const commitRename = () => {
    if (!renaming) return
    const name = renaming.value.trim()
    if (name) {
      if (renaming.kind === 'note') renameNote(renaming.id, name)
      else renameFolder(renaming.id, name)
    }
    setRenaming(null)
  }

  const renameInput = (
    <Input
      value={renaming?.value ?? ''}
      autoFocus
      className="h-7 text-xs"
      onChange={(e) => {
        if (renaming) setRenaming({ ...renaming, value: e.target.value })
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename()
        if (e.key === 'Escape') setRenaming(null)
      }}
    />
  )

  const renderNoteItem = (n: Note) =>
    renaming?.kind === 'note' && renaming.id === n.id ? (
      <div key={n.id} className="flex items-center gap-1 px-2 py-1">
        {renameInput}
      </div>
    ) : (
      <NoteItem
        key={n.id}
        note={n}
        active={n.id === activeId}
        onClick={() => setActive(n.id)}
        onRename={() => setRenaming({ kind: 'note', id: n.id, value: n.title })}
        onDelete={() => removeNote(n.id)}
        folders={folders}
        currentFolderId={n.folderId ?? null}
        onMove={(folderId) => setNoteFolder(n.id, folderId)}
      />
    )

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-sidebar [contain:strict]">
      <div className="flex flex-col gap-3 border-b px-4 py-2">
        <div className="flex h-10 items-center justify-between text-foreground">
          <img src="/themd-logo.png" alt="Themd" className="h-6 w-auto shrink-0" />
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => window.dispatchEvent(new CustomEvent('themd:open-settings'))}
              aria-label="设置"
              title="设置"
            >
              <Settings />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => window.dispatchEvent(new CustomEvent('themd:collapse-sidebar'))}
              aria-label="收起侧栏"
              title="收起侧栏"
            >
              <PanelLeftClose />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => createNote()}>
            <Plus /> 新建
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCreateFolder}
            aria-label="新建分组"
            title="新建分组"
          >
            <FolderPlus />
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FolderUp /> 导入
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            multiple
            hidden
            onChange={handleImport}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索笔记..."
            className="pl-8"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {folders.map((f) => {
          const items = byFolder.get(f.id) ?? []
          const isRenaming = renaming?.kind === 'folder' && renaming.id === f.id
          return (
            <Collapsible key={f.id} defaultOpen>
              {isRenaming ? (
                <div className="flex items-center gap-1 px-2 py-1">{renameInput}</div>
              ) : (
                <div className="group/row flex items-center rounded-lg transition-colors hover:bg-sidebar-accent">
                  <CollapsibleTrigger className="group/chev flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm font-medium">
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/chev:rotate-90" />
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                      <Folder className="size-3" />
                    </span>
                    <span className="truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{items.length}</span>
                  </CollapsibleTrigger>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
                        aria-label={`分组 ${f.name} 操作`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40">
                      <DropdownMenuItem
                        onClick={() => setRenaming({ kind: 'folder', id: f.id, value: f.name })}
                      >
                        <Pencil /> 重命名分组
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const id = createNote()
                          setNoteFolder(id, f.id)
                          setActive(id)
                        }}
                      >
                        <Plus /> 新笔记到此分组
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => removeFolder(f.id)}>
                        <Trash2 /> 删除分组
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              <CollapsibleContent>
                {/* 组内笔记缩进并加参考线,和根目录笔记拉开层级 */}
                <div className="ml-4 border-l border-sidebar-border/70 pl-1.5">
                  {items.map(renderNoteItem)}
                  {items.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">空分组</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}

        {(byFolder.get('') ?? []).map(renderNoteItem)}

        {notes.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            没有匹配的笔记
          </p>
        )}
        {notes.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <FileText className="size-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              还没有笔记，点「新建」或「导入」开始
            </p>
          </div>
        )}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={() => folderInputRef.current?.click()}
        >
          <FolderInput /> 导入文件夹…
        </Button>
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error 非标准属性,Chromium 支持
          webkitdirectory=""
          hidden
          onChange={handleFolderImport}
        />
      </div>
    </aside>
  )
}

function NoteItem({
  note,
  active,
  onClick,
  onRename,
  onDelete,
  folders,
  currentFolderId,
  onMove,
}: {
  note: Note
  active: boolean
  onClick: () => void
  onRename: () => void
  onDelete: () => void
  folders: { id: string; name: string }[]
  currentFolderId: string | null
  onMove: (folderId: string | null) => void
}) {
  return (
    <div
      className={cn(
        'group flex w-full items-center gap-2 rounded-lg pr-1 transition-colors hover:bg-sidebar-accent',
        active ? 'bg-sidebar-accent' : '',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400">
          <FileText className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate', active && 'font-medium')}>
            {note.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {fromNow(note.updatedAt)}
          </span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label={`笔记 ${note.title} 操作`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        {/* 菜单默认宽度跟随 ⋯ 触发器,被 min-w-32 兜底;「移动到分组」差一点就换行,加宽到 min-w-44 */}
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={onRename}>
            <Pencil /> 重命名
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput /> 移动到分组
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-32">
              <DropdownMenuItem onClick={() => onMove(null)}>
                {currentFolderId === null ? '✓ ' : ''}未分组
              </DropdownMenuItem>
              {folders.map((f) => (
                <DropdownMenuItem key={f.id} onClick={() => onMove(f.id)}>
                  {currentFolderId === f.id ? '✓ ' : ''}
                  {f.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 /> 删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
