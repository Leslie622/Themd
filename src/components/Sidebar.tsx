import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { FileText, FolderUp, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { readFiles } from '@/lib/files'
import { fromNow } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useNotebook } from '@/store'
import type { Note } from '@/store'

export function Sidebar() {
  const notes = useNotebook((s) => s.notes)
  const activeId = useNotebook((s) => s.activeId)
  const setActive = useNotebook((s) => s.setActive)
  const createNote = useNotebook((s) => s.createNote)

  const [keyword, setKeyword] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const imported = await readFiles(files)
    for (const f of imported) createNote(f.title, f.content)
    e.target.value = '' // 允许再次导入同名文件
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="flex items-baseline gap-2 px-1">
          <span className="text-base font-semibold tracking-tight">Themd</span>
          <span className="text-xs text-muted-foreground">样式自设的 MD 笔记本</span>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => createNote()}>
            <Plus /> 新建
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
        {filtered.map((n) => (
          <NoteItem
            key={n.id}
            note={n}
            active={n.id === activeId}
            onClick={() => setActive(n.id)}
          />
        ))}
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
    </aside>
  )
}

function NoteItem({
  note,
  active,
  onClick,
}: {
  note: Note
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent',
        active && 'bg-sidebar-accent font-medium',
      )}
    >
      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{note.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {fromNow(note.updatedAt)}
        </span>
      </span>
    </button>
  )
}
