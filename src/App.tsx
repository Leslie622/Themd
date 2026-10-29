import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  Columns2,
  Eye,
  FileCode2,
  FileSymlink,
  FileText,
  ImagePlus,
  Paintbrush,
  Palette,
  PanelLeft,
  PenLine,
  Plus,
  Printer,
  Settings,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { usePanelRef } from 'react-resizable-panels'
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
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useSyncScroll } from '@/lib/scroll-sync'
import { downloadNote, saveTextViaDialog } from '@/lib/files'
import { buildStandaloneHtml } from '@/lib/export-html'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
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
  // 主题选择器的语义补全:「跟随全局」跟随的是哪个主题,把名字亮出来
  const allThemes = useMemo(
    () => listAllThemes({ themes: themeList, activeId: themeActiveId }),
    [themeList, themeActiveId],
  )
  const globalThemeName = useMemo(
    () => resolveActiveTheme({ themes: themeList, activeId: themeActiveId }).name,
    [themeList, themeActiveId],
  )
  const noteThemeLabel = active
    ? active.themeId
      ? `笔记主题:仅此笔记(${allThemes.find((t) => t.id === active.themeId)?.name ?? '主题已删除'})`
      : `笔记主题:跟随全局(当前:${globalThemeName})`
    : '笔记主题'

  const [view, setView] = useState<ViewMode>('split')
  const { bindEditorScroller, bindPreviewScroller } = useSyncScroll()
  const [studioOpen, setStudioOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const sidebarPanelRef = usePanelRef()

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

  // 导出 PDF:桌面端选好位置后调 WebView2 PrintToPdf 直接生成(Typora 式,不弹打印);
  // Web 端回落系统打印(打印预览里选「另存为 PDF」)。两者都靠预览视图 + @media print 样式出稿
  const printPrevView = useRef<ViewMode | null>(null)
  // 'print' = 系统打印;其他字符串 = 桌面端 PDF 目标路径
  const pendingExportRef = useRef<null | 'print' | string>(null)
  const runPendingExport = useCallback(() => {
    const pending = pendingExportRef.current
    if (!pending) return
    pendingExportRef.current = null
    const restore = () => {
      const prev = printPrevView.current
      printPrevView.current = null
      if (prev && prev !== 'preview') setView(prev)
    }
    if (pending === 'print') {
      window.print() // 打印对话框关闭(含取消)后由 afterprint 恢复原视图
      return
    }
    void import('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('export_pdf', { path: pending }))
      .then(() => toast.success(`已保存到 ${pending}`))
      .catch((e) => toast.error(`PDF 导出失败: ${String(e)}`))
      .finally(restore)
  }, [])
  useEffect(() => {
    const onAfterPrint = () => {
      const prev = printPrevView.current
      printPrevView.current = null
      if (prev && prev !== 'preview') setView(prev)
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])
  // 渲染完成后执行挂起的导出(此时预览必然已挂载);不用 rAF——后台窗口会被节流
  useEffect(() => {
    runPendingExport()
  }, [runPendingExport, view])
  const exportPdf = async () => {
    const { isTauri } = await import('@/lib/theme/font-list')
    printPrevView.current = view
    if (isTauri()) {
      if (!active) return
      const { save } = await import('@tauri-apps/plugin-dialog')
      const path = await save({
        defaultPath: `${active.title || 'note'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (!path) {
        printPrevView.current = null
        return
      }
      pendingExportRef.current = path
    } else {
      pendingExportRef.current = 'print'
    }
    if (view === 'preview') {
      runPendingExport()
    } else {
      setView('preview') // 预览挂载后由 effect 接手
    }
  }
  // 文件导出:桌面端原生「另存为」选位置写盘;Web 端回落浏览器下载
  const exportNoteFile = async (kind: 'md' | 'html') => {
    if (!active) return
    const name = active.title || 'note'
    try {
      const result =
        kind === 'md'
          ? await saveTextViaDialog(`${name}.md`, active.content, 'Markdown 文档', ['md'])
          : await saveTextViaDialog(`${name}.html`, buildStandaloneHtml(active), 'HTML 文档', ['html'])
      if (result === 'canceled') return
      if (result === 'web') {
        if (kind === 'md') downloadNote(active)
        else {
          const { downloadNoteHtml } = await import('@/lib/export-html')
          downloadNoteHtml(active)
        }
        toast.success(`已导出「${active.title}」.${kind}`)
      } else {
        toast.success(`已保存到 ${result}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败')
    }
  }

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
          /* 回归库默认的按比例布局:窗口缩放时侧栏按百分比跟随,主区同比例伸缩。
             约束仍用像素(240 下限保内容不挤,400 上限防霸屏) */
          defaultSize="24%"
          minSize={240}
          maxSize="45%"
          collapsible
          collapsedSize="0"
          /* 折叠/展开的磁吸阈值:collapsedSize(0)与 minSize(240)的中点 120——
             宽度 <120 折叠、>120 展开。曾经误设 240(= minSize),语义变成
             「拖到 -240px 才折叠」,库在边界反复回弹导致折叠按钮左右抖 */
          collapsedThreshold={120}
          onResize={(size) => {
            // 仅维护折叠状态(顶栏「展开」按钮显隐);布局完全交给库 + CSS
            setSidebarCollapsed(size.inPixels < 120)
          }}
        >
          <Sidebar />
        </ResizablePanel>
        <ResizableHandle withHandle />
        {/* 主区下限也用像素:窗口最小 860(Tauri 保证),860 - 240 - 1 = 619 > 400,
            约束域无交叠,布局器任何窗口宽度下都有唯一解,不会把侧栏压过折叠阈值
            再弹回(那种来回解算就是折叠按钮的状态横跳/闪烁) */}
        <ResizablePanel minSize={400}>
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
                {/* —— 视图组(最左):编辑/分屏/预览,纯图标减密度,悬停看含义 —— */}
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

                {/* —— 内容组:笔记主题 + 插图 + 导出 ——
                    用裸 div 而非 Separator:其基类 data-vertical:self-stretch 会让
                    有确定高度的元素按 flex-start 顶到上沿,垂直分隔永远对不齐 */}
                <div aria-hidden className="mx-1 h-5 w-px shrink-0 self-center bg-border" />

                {/* 笔记主题:单篇覆盖;全局主题在「设置」里切换 */}
                <Select
                  value={active.themeId ?? FOLLOW_GLOBAL}
                  onValueChange={(v) => setNoteTheme(active.id, v === FOLLOW_GLOBAL ? null : v)}
                >
                  <IconTip label={noteThemeLabel}>
                    <SelectTrigger
                      size="default"
                      className="relative w-8 justify-center border-none px-0 hover:bg-accent [&>svg:last-child]:hidden dark:bg-transparent"
                      aria-label={noteThemeLabel}
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
                    <SelectItem value={FOLLOW_GLOBAL}>跟随全局</SelectItem>
                    {allThemes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="truncate">{t.name}</span>
                        {active.themeId === t.id && active.themeId ? (
                          <span className="ml-auto pl-2 text-xs text-primary">仅此笔记</span>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
                {/* 导出:三种格式进下拉;FileSymlink 箭头向右穿出文件,
                    与侧栏 FileInput/FolderInput(箭头指入)构成导入/导出一对 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="导出笔记"
                    >
                      <FileSymlink />
                    </Button>
                  </DropdownMenuTrigger>
                  {/* 基类把菜单宽度锁在触发按钮宽度,导出条目文本长,抬个下限防换行 */}
                  <DropdownMenuContent align="end" style={{ minWidth: '12rem' }}>
                    <DropdownMenuItem onClick={() => void exportNoteFile('md')}>
                      <FileText />
                      导出 Markdown (.md)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void exportNoteFile('html')}>
                      <FileCode2 />
                      导出 HTML (.html)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportPdf}>
                      <Printer />
                      导出 PDF(打印)…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* —— 定制组(最右):主题工厂 + 设置 —— */}
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
                <IconTip label="设置:外观、编辑器与字体偏好">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setSettingsOpen(true)}
                    aria-label="打开设置"
                  >
                    <Settings />
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
                <ResizableHandle withHandle />
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
