import { useEffect, useRef, useState } from 'react'
import {
  Columns2,
  Download,
  Eye,
  MoreHorizontal,
  Palette,
  PanelLeft,
  PenLine,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { usePanelRef } from 'react-resizable-panels'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Sidebar } from '@/components/Sidebar'
import { WindowControls } from '@/components/WindowControls'
import { SettingsSheet } from '@/components/SettingsSheet'
import { EditorPane } from '@/components/EditorPane'
import { PreviewPane } from '@/components/PreviewPane'
import { ThemeStudio } from '@/components/theme/ThemeStudio'
import { useNotebook } from '@/store'
import { listAllThemes, useThemeStore } from '@/store-themes'
import { useSyncScroll } from '@/lib/scroll-sync'
import { downloadNote } from '@/lib/files'
import { fromNow } from '@/lib/time'

type ViewMode = 'edit' | 'split' | 'preview'

export default function App() {
  const notes = useNotebook((s) => s.notes)
  const activeId = useNotebook((s) => s.activeId)
  const updateNote = useNotebook((s) => s.updateNote)
  const createNote = useNotebook((s) => s.createNote)
  const setNoteTheme = useNotebook((s) => s.setNoteTheme)
  const themeList = useThemeStore((s) => s.themes)
  const themeActiveId = useThemeStore((s) => s.activeId)

  const active = notes.find((n) => n.id === activeId) ?? null

  const [view, setView] = useState<ViewMode>('split')
  const { bindEditorScroller, bindPreviewScroller } = useSyncScroll()
  const [studioOpen, setStudioOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const sidebarPanelRef = usePanelRef()
  const sidebarResizeRaf = useRef(0)

  useEffect(() => {
    const onCollapse = () => sidebarPanelRef.current?.collapse()
    window.addEventListener("themd:collapse-sidebar", onCollapse)
    const onSettings = () => setSettingsOpen(true)
    window.addEventListener("themd:open-settings", onSettings)
    return () => {
      window.removeEventListener("themd:collapse-sidebar", onCollapse)
      window.removeEventListener("themd:open-settings", onSettings)
    }
  }, [sidebarPanelRef])
  const [previewText, setPreviewText] = useState('')

  // 切换笔记时预览立即刷新
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewText(active?.content ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  // 输入防抖 150ms 再渲染，避免大文档下打字卡顿
  useEffect(() => {
    const timer = setTimeout(() => setPreviewText(active?.content ?? ''), 150)
    return () => clearTimeout(timer)
  }, [active?.content])

  // 主题工场:全屏接管主区域(窗口按钮由 ThemeStudio 顶栏提供)
  if (studioOpen) {
    return (
      <div className="flex h-full w-full">
        <ThemeStudio onBack={() => setStudioOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel
          panelRef={sidebarPanelRef}
          defaultSize="24%"
          minSize="15%"
          maxSize="45%"
          collapsible
          collapsedSize="0"
          onResize={(size) => {
            // 拖动时高频回调:同步比对开销大,经 rAF 合帧,一帧至多一次 setState
            if (!sidebarResizeRaf.current) {
              sidebarResizeRaf.current = requestAnimationFrame(() => {
                sidebarResizeRaf.current = 0
                setSidebarCollapsed(size.asPercentage === 0)
              })
            }
          }}
        >
          <Sidebar />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize="40%">
          <main className="flex h-full min-w-0 flex-col">
        {active ? (
          <>
            <header
              data-tauri-drag-region
              className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                {sidebarCollapsed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => sidebarPanelRef.current?.expand()}
                    aria-label="展开侧栏"
                    title="展开侧栏"
                  >
                    <PanelLeft />
                  </Button>
                )}
                <h1 data-tauri-drag-region className="truncate text-sm font-semibold">
                  {active.title}
                </h1>
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

                {/* 视图切换:纯图标减密度,悬停看含义 */}
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  spacing={0}
                  value={view}
                  onValueChange={(v) => {
                    if (v) setView(v as ViewMode)
                  }}
                >
                  <ToggleGroupItem value="edit" aria-label="编辑视图" title="编辑视图">
                    <PenLine />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="split" aria-label="分屏视图" title="分屏视图">
                    <Columns2 />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="preview" aria-label="预览视图" title="预览视图">
                    <Eye />
                  </ToggleGroupItem>
                </ToggleGroup>

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
                  <DropdownMenuContent align="end" className="min-w-36">
                    <DropdownMenuItem
                      onClick={() => {
                        downloadNote(active)
                        toast.success(`已导出「${active.title}」`)
                      }}
                    >
                      <Download /> 导出为 .md
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <WindowControls />
              </div>
            </header>

            {view === 'split' ? (
              <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <EditorPane
                    key={active.id}
                    value={active.content}
                    onChange={(v) => updateNote(active.id, v)}
                    bindScroller={bindEditorScroller}
                  />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <PreviewPane
                    content={previewText}
                    noteThemeId={active.themeId}
                    bindScroller={bindPreviewScroller}
                  />
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
        </ResizablePanel>
      </ResizablePanelGroup>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster />
    </div>
  )
}
