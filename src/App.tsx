import { useEffect, useState } from 'react'
import {
  Columns2,
  Download,
  Eye,
  MoreHorizontal,
  Palette,
  PenLine,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { Sidebar } from '@/components/Sidebar'
import { EditorPane } from '@/components/EditorPane'
import { PreviewPane } from '@/components/PreviewPane'
import { ThemeStudio } from '@/components/theme/ThemeStudio'
import { useNotebook } from '@/store'
import { listAllThemes, useThemeStore } from '@/store-themes'
import { downloadNote } from '@/lib/files'
import { fromNow } from '@/lib/time'

type ViewMode = 'edit' | 'split' | 'preview'

export default function App() {
  const notes = useNotebook((s) => s.notes)
  const activeId = useNotebook((s) => s.activeId)
  const updateNote = useNotebook((s) => s.updateNote)
  const renameNote = useNotebook((s) => s.renameNote)
  const removeNote = useNotebook((s) => s.removeNote)
  const createNote = useNotebook((s) => s.createNote)
  const setNoteTheme = useNotebook((s) => s.setNoteTheme)
  const themeList = useThemeStore((s) => s.themes)
  const themeActiveId = useThemeStore((s) => s.activeId)

  const active = notes.find((n) => n.id === activeId) ?? null

  const [view, setView] = useState<ViewMode>('split')
  const [studioOpen, setStudioOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  // 切换笔记时预览立即刷新
  useEffect(() => {
    setPreviewText(active?.content ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // 输入防抖 150ms 再渲染，避免大文档下打字卡顿
  useEffect(() => {
    const timer = setTimeout(() => setPreviewText(active?.content ?? ''), 150)
    return () => clearTimeout(timer)
  }, [active?.content])

  // 主题工场：全屏接管主区域
  if (studioOpen) {
    return (
      <div className="flex h-full w-full">
        <ThemeStudio onBack={() => setStudioOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
              <div className="flex min-w-0 items-baseline gap-3">
                <h1 className="truncate text-sm font-semibold">{active.title}</h1>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {active.content.length} 字 · {fromNow(active.updatedAt)}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {/* 笔记主题:独立下拉,直接可见当前主题 */}
                <Select
                  value={active.themeId ?? ''}
                  onValueChange={(v) => setNoteTheme(active.id, v || null)}
                >
                  <SelectTrigger size="sm" className="w-fit max-w-44 gap-1.5" aria-label="笔记主题">
                    <Palette className="size-4 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="笔记主题" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="min-w-(--radix-select-trigger-width)">
                    <SelectItem value="">
                      <span className="truncate">跟随全局</span>
                    </SelectItem>
                    {listAllThemes({ themes: themeList, activeId: themeActiveId }).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="truncate">{t.name}</span>
                        {active.themeId === t.id && active.themeId ? (
                          <span className="ml-auto pl-2 text-xs text-primary">仅此笔记</span>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* 视图切换:一个分组区块 */}
                <div className="flex overflow-hidden rounded-lg border">
                  <ToggleGroup
                    type="single"
                    className="gap-0"
                    value={view}
                    onValueChange={(v) => {
                      if (v) setView(v as ViewMode)
                    }}
                  >
                    <ToggleGroupItem
                      value="edit"
                      aria-label="编辑视图"
                      className="rounded-none px-3"
                    >
                      <PenLine /> 编辑
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="split"
                      aria-label="分屏视图"
                      className="rounded-none border-x px-3"
                    >
                      <Columns2 /> 分屏
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="preview"
                      aria-label="预览视图"
                      className="rounded-none px-3"
                    >
                      <Eye /> 预览
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* 主题工厂 + 笔记操作 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStudioOpen(true)}
                  aria-label="打开主题工厂"
                  title="打开主题工厂:可视化定制渲染样式"
                >
                  <Palette /> 主题工厂
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="笔记操作">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameValue(active.title)
                        setRenameOpen(true)
                      }}
                    >
                      <Pencil /> 重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        downloadNote(active)
                        toast.success(`已导出「${active.title}」`)
                      }}
                    >
                      <Download /> 导出为 .md
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 /> 删除笔记
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {view === 'split' ? (
              <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <EditorPane
                    key={active.id}
                    value={active.content}
                    onChange={(v) => updateNote(active.id, v)}
                  />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <PreviewPane content={previewText} noteThemeId={active.themeId} />
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : view === 'edit' ? (
              <div className="min-h-0 flex-1">
                <EditorPane
                  key={active.id}
                  value={active.content}
                  onChange={(v) => updateNote(active.id, v)}
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1">
                <PreviewPane content={previewText} noteThemeId={active.themeId} />
              </div>
            )}

            <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>重命名笔记</DialogTitle>
                  <DialogDescription>
                    手动命名后，标题不再自动跟随正文首行。
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameValue.trim()) {
                      renameNote(active.id, renameValue.trim())
                      setRenameOpen(false)
                    }
                  }}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRenameOpen(false)}>
                    取消
                  </Button>
                  <Button
                    onClick={() => {
                      if (renameValue.trim()) {
                        renameNote(active.id, renameValue.trim())
                        setRenameOpen(false)
                      }
                    }}
                  >
                    保存
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>删除笔记</DialogTitle>
                  <DialogDescription>
                    确定删除「{active.title}」吗？此操作不可恢复。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      removeNote(active.id)
                      setDeleteOpen(false)
                      toast.success('已删除')
                    }}
                  >
                    删除
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-sm text-muted-foreground">选择左侧笔记，或开始一篇新笔记</p>
            <Button onClick={() => createNote()}>
              <Plus /> 新建笔记
            </Button>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  )
}
