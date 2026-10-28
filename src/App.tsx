import { useEffect, useRef, useState, type ReactElement } from 'react'
import {
  Columns2,
  Eye,
  FileSymlink,
  ImagePlus,
  Paintbrush,
  Palette,
  PanelLeft,
  PenLine,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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

/** 「跟随全局」的哨兵值:radix Select 不支持空字符串 value,用哨兵让触发器始终显示当前状态 */
const FOLLOW_GLOBAL = '__follow__'

/** 头部图标按钮的统一气泡提示:走 shadcn Tooltip(与侧栏一致),替代原生 title */
function IconTip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

export default function App() {
  const hydrated = useNotebook((s) => s.hydrated)
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

  // 笔记存储在 IndexedDB,异步水合完成前不渲染,避免闪默认欢迎笔记
  if (!hydrated) return null

  return (
    /* Provider 包整个根:顶栏左侧的"展开侧栏"按钮(仅折叠时渲染)也在 Tooltip
       作用域内,否则一折叠就 Tooltip 脱离 Provider 导致 React 崩溃白屏 */
    <TooltipProvider delayDuration={300}>
    <div className="flex h-full">
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel
          panelRef={sidebarPanelRef}
          defaultSize="24%"
          /* 最小宽按内容实测定值(px):快捷操作行(新建+3个导入)自然宽约200px+内边距,
             240px 以下内部布局会挤压换行;阈值同步用 px,保证拖动永不吸附折叠 */
          minSize={240}
          maxSize="45%"
          collapsible
          collapsedSize="0"
          collapsedThreshold={240}
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
        {/* 顶栏常驻:decorations:false 下窗口按钮与拖拽区只在这里,空状态也不能丢;
            笔记标题/主题/视图等控件仅在选中笔记时显示 */}
        <header
          data-tauri-drag-region
          className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            {sidebarCollapsed && (
              <IconTip label="展开侧栏">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => sidebarPanelRef.current?.expand()}
                  aria-label="展开侧栏"
                >
                  <PanelLeft />
                </Button>
              </IconTip>
            )}
            {active && (
              <>
                <h1 data-tauri-drag-region className="truncate text-sm font-semibold">
                  {active.title}
                </h1>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {active.content.length} 字 · {fromNow(active.updatedAt)}
                </span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {active && (
              <>
                {/* —— 笔记呈现组:主题 + 视图,都是当前笔记的展示状态 —— */}
                <Select
                  value={active.themeId ?? FOLLOW_GLOBAL}
                  onValueChange={(v) => setNoteTheme(active.id, v === FOLLOW_GLOBAL ? null : v)}
                >
                  <IconTip label={active.themeId ? '笔记主题:已单独设置' : '笔记主题:跟随全局'}>
                    <SelectTrigger
                      size="default"
                      className="relative w-8 justify-center border-none px-0 hover:bg-accent [&>svg:last-child]:hidden dark:bg-transparent"
                      aria-label={`笔记主题:${active.themeId ? '已单独设置' : '跟随全局'}`}
                    >
                      <Palette className="size-4 shrink-0" />
                      {active.themeId && (
                        <span
                          aria-hidden
                          className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
                        />
                      )}
                    </SelectTrigger>
                  </IconTip>
                  <SelectContent position="popper" className="min-w-(--radix-select-trigger-width)">
                    <SelectItem value={FOLLOW_GLOBAL}>
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
                  variant="default"
                  size="sm"
                  spacing={0}
                  value={view}
                  onValueChange={(v) => {
                    if (v) setView(v as ViewMode)
                  }}
                >
                  <IconTip label="编辑视图">
                    <ToggleGroupItem value="edit" aria-label="编辑视图">
                      <PenLine className="size-4" />
                    </ToggleGroupItem>
                  </IconTip>
                  <IconTip label="分屏视图">
                    <ToggleGroupItem value="split" aria-label="分屏视图">
                      <Columns2 className="size-4" />
                    </ToggleGroupItem>
                  </IconTip>
                  <IconTip label="预览视图">
                    <ToggleGroupItem value="preview" aria-label="预览视图">
                      <Eye className="size-4" />
                    </ToggleGroupItem>
                  </IconTip>
                </ToggleGroup>

                {/* —— 功能入口组:主题工厂是全屏接管的功能路由,用分隔线与笔记呈现组拉开 ——
                    用裸 div 而非 Separator:其基类 data-vertical:self-stretch 会让
                    有确定高度的元素按 flex-start 顶到上沿,垂直分隔永远对不齐 */}
                <div aria-hidden className="mx-1 h-5 w-px shrink-0 self-center bg-border" />
                <IconTip label="打开主题工厂:可视化定制渲染样式">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setStudioOpen(true)}
                    aria-label="打开主题工厂"
                  >
                    <Paintbrush />
                  </Button>
                </IconTip>
                <IconTip label="插入图片:支持直接粘贴或拖拽进编辑器">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => window.dispatchEvent(new Event('themd:insert-image'))}
                    aria-label="插入图片"
                  >
                    <ImagePlus />
                  </Button>
                </IconTip>
                {/* 导出:唯一动作,直接图标按钮,不套下拉;FileSymlink 箭头向右穿出文件,
                    与侧栏 FileInput/FolderInput(箭头指入)构成导入/导出一对 */}
                <IconTip label="导出当前笔记为 .md 文件">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => {
                      downloadNote(active)
                      toast.success(`已导出「${active.title}」`)
                    }}
                    aria-label="导出为 .md"
                  >
                    <FileSymlink />
                  </Button>
                </IconTip>
              </>
            )}
            <WindowControls />
            </div>
        </header>

        {active ? (
          <>
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
    </TooltipProvider>
  )
}
