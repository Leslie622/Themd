import { type ReactElement, type RefObject } from 'react'
import { Columns2, Eye, FileCode2, FileSymlink, FileText, ImagePlus, Paintbrush, Palette, PanelLeft, PenLine, Plus, Printer, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import type { PanelImperativeHandle } from 'react-resizable-panels'
import { Toaster } from '@/components/ui/sonner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Sidebar } from '@/components/Sidebar'
import { clampSidebarWidth, SIDEBAR_MIN_WIDTH } from '@/app/workspace-preferences'
import { WindowControls } from '@/components/WindowControls'
import { SettingsSheet } from '@/components/SettingsSheet'
import { EditorPane } from '@/components/EditorPane'
import { PreviewPane } from '@/components/PreviewPane'
import { fromNow } from '@/lib/time'
import { appEvents } from '@/shared/events/app-events'
import type { Note } from '@/modules/notebook/domain/note'
import type { ThemeFile } from '@/lib/theme/schema'
export type ViewMode = 'edit' | 'split' | 'preview'
const FOLLOW_GLOBAL = '__follow__'
const SIDEBAR_PANEL_ID = 'sidebar'
function IconTip({ label, children }: { label: string; children: ReactElement }) { return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="bottom">{label}</TooltipContent></Tooltip> }
export interface AppShellProps { active: Note | null; allThemes: ThemeFile[]; noteThemeLabel: string; view: ViewMode; setView: (view: ViewMode) => void; previewText: string; sidebarCollapsed: boolean; setSidebarCollapsed: (collapsed: boolean) => void; sidebarPanelRef: RefObject<PanelImperativeHandle | null>; sidebarWidth: number; onSidebarWidthCommit: (px: number) => void; settingsOpen: boolean; setSettingsOpen: (open: boolean) => void; setStudioOpen: (open: boolean) => void; updateNote: (id: string, content: string) => void; createNote: () => void; setNoteTheme: (id: string, themeId: string | null) => void; exportPdf: () => void; exportNoteFile: (kind: 'md' | 'html') => void; bindEditorScroller: (element: HTMLElement | null) => void; bindPreviewScroller: (element: HTMLElement | null) => void }
export function AppShell({ active, allThemes, noteThemeLabel, view, setView, previewText, sidebarCollapsed, setSidebarCollapsed, sidebarPanelRef, sidebarWidth, onSidebarWidthCommit, settingsOpen, setSettingsOpen, setStudioOpen, updateNote, createNote, setNoteTheme, exportPdf, exportNoteFile, bindEditorScroller, bindPreviewScroller }: AppShellProps) {
  return (
    /* Provider 包整个根:顶栏左侧的"展开侧栏"按钮(仅折叠时渲染)也在 Tooltip
       作用域内,否则一折叠就 Tooltip 脱离 Provider 导致 React 崩溃白屏 */
    <TooltipProvider delayDuration={300}>
    <div className="flex h-full">
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1"
        /* 侧栏像素宽度只在用户手势结束时落库:isUserInteraction 过滤掉
           折叠命令、窗口缩放等程序性布局变化,避免把 0/压缩值写进存储。
           layout 是百分比,像素从面板 ref 现取(手势刚结束,数值已落定) */
        onLayoutChanged={(layout, meta) => {
          if (!meta.isUserInteraction) return
          const percentage = layout[SIDEBAR_PANEL_ID]
          if (typeof percentage !== 'number' || percentage <= 0) return
          const pixels = sidebarPanelRef.current?.getSize().inPixels
          if (typeof pixels === 'number') onSidebarWidthCommit(clampSidebarWidth(pixels))
        }}
      >
        <ResizablePanel
          id={SIDEBAR_PANEL_ID}
          panelRef={sidebarPanelRef}
          /* 侧栏按像素记忆与保持:defaultSize 用像素,窗口缩放时增量全给主区。 */
          defaultSize={`${sidebarWidth}px`}
          minSize={SIDEBAR_MIN_WIDTH}
          maxSize={560}
          collapsible
          collapsedSize="0"
          collapsedThreshold={120}
          groupResizeBehavior="preserve-pixel-size"
          onResize={(size) => {
            setSidebarCollapsed(size.inPixels < 120)
          }}
        >
          <Sidebar />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize={400} groupResizeBehavior="preserve-relative-size">
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
                    onClick={() => appEvents.emit('insertImage')}
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


