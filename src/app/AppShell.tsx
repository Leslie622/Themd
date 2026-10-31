import { type ReactElement, type ReactNode, useRef } from 'react'
import { Columns2, Eye, FileCode2, FileSymlink, FileText, FileWarning, ImagePlus, Paintbrush, Palette, PanelLeft, PenLine, Plus, Printer, Save, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Toaster } from '@/components/ui/sonner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Sidebar } from '@/components/Sidebar'
import { SidebarResizeHandle } from '@/components/SidebarResizeHandle'
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '@/app/workspace-preferences'
import { WindowControls } from '@/components/WindowControls'
import { SettingsSheet } from '@/components/SettingsSheet'
import { EditorPane } from '@/components/EditorPane'
import { PreviewPane } from '@/components/PreviewPane'
import { fromNow } from '@/lib/time'
import { countImages, countWords } from '@/modules/notebook/domain/note'
import { appEvents } from '@/shared/events/app-events'
import type { Note } from '@/modules/notebook/domain/note'
import type { ThemeFile } from '@/lib/theme/schema'
export type ViewMode = 'edit' | 'split' | 'preview'
const FOLLOW_GLOBAL = '__follow__'
function IconTip({ label, children }: { label: string; children: ReactElement }) { return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent side="bottom">{label}</TooltipContent></Tooltip> }
export interface AppShellProps { active: Note | null; allThemes: ThemeFile[]; noteThemeLabel: string; view: ViewMode; setView: (view: ViewMode) => void; previewText: string; sidebarCollapsed: boolean; onSidebarExpand: () => void; sidebarWidth: number; onSidebarWidthCommit: (px: number) => void; settingsOpen: boolean; setSettingsOpen: (open: boolean) => void; setStudioOpen: (open: boolean) => void; updateNote: (id: string, content: string) => void; createNote: () => void; setNoteTheme: (id: string, themeId: string | null) => void; exportPdf: () => void; exportNoteFile: (kind: 'md' | 'html') => void; fileMissing: boolean; onNoteSaveAs: () => void; onNoteDelete: () => void; bindEditorScroller: (element: HTMLElement | null) => void; bindPreviewScroller: (element: HTMLElement | null) => void; children?: ReactNode }
export function AppShell({ active, allThemes, noteThemeLabel, view, setView, previewText, sidebarCollapsed, onSidebarExpand, sidebarWidth, onSidebarWidthCommit, settingsOpen, setSettingsOpen, setStudioOpen, updateNote, createNote, setNoteTheme, exportPdf, exportNoteFile, fileMissing, onNoteSaveAs, onNoteDelete, bindEditorScroller, bindPreviewScroller, children }: AppShellProps) {
  const imageCount = active ? countImages(active.content) : 0
  /* 侧栏容器:拖拽期间 SidebarResizeHandle 直改它的 style.width,绕开 React */
  const sidebarRef = useRef<HTMLDivElement | null>(null)
  /* 弹层内发生过指针按下 → 关闭时不让 Radix 把焦点还给触发器:
     那次还焦点会继承列表项的 :focus-visible,触发器常驻聚焦环,
     且 tooltip focus 守卫把它当键盘焦点放行 → tooltip 常驻 */
  const themeSelectPointerDown = useRef(false)
  const exportMenuPointerDown = useRef(false)
  return (
    /* Provider 包整个根:顶栏左侧的"展开侧栏"按钮(仅折叠时渲染)也在 Tooltip
       作用域内,否则一折叠就 Tooltip 脱离 Provider 导致 React 崩溃白屏 */
    <TooltipProvider delayDuration={300}>
    <div className="flex h-full">
      {/* 侧栏是固定像素宽的普通 flex 区块,不参与 react-resizable-panels:
          百分比引擎靠 JS 追赶校正,窗口缩放时浏览器先按旧百分比画脏帧
          导致内容抖动;纯 CSS 像素宽由布局层逐帧保证,零 JS 参与。 */}
      {sidebarCollapsed ? null : (
        <>
          <div ref={sidebarRef} className="h-full shrink-0 overflow-hidden" style={{ width: sidebarWidth }}>
            <Sidebar />
          </div>
          <SidebarResizeHandle
            targetRef={sidebarRef}
            min={SIDEBAR_MIN_WIDTH}
            max={SIDEBAR_MAX_WIDTH}
            onCommit={onSidebarWidthCommit}
            onReset={() => onSidebarWidthCommit(SIDEBAR_DEFAULT_WIDTH)}
          />
        </>
      )}
      <main className="flex h-full min-w-0 flex-1 flex-col">
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
                  onClick={onSidebarExpand}
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
                  {countWords(active.content)} 字{imageCount > 0 ? ` · ${imageCount} 图` : ''} · {fromNow(active.updatedAt)}
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
                  <SelectContent
                    onPointerDown={() => {
                      themeSelectPointerDown.current = true
                    }}
                    onCloseAutoFocus={(e) => {
                      if (themeSelectPointerDown.current) {
                        themeSelectPointerDown.current = false
                        e.preventDefault()
                      }
                    }}
                  >
                    <SelectGroup>
                      <SelectItem value={FOLLOW_GLOBAL}>跟随全局</SelectItem>
                      {allThemes.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="truncate">{t.name}</span>
                          {active.themeId === t.id && active.themeId ? (
                            <span className="ml-auto pl-2 text-xs text-primary">仅此笔记</span>
                          ) : null}
                        </SelectItem>
                      ))}
                    </SelectGroup>
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
                {/* 另存为是「文件落到哪」的操作,不属于导出格式,独立成按钮:
                    未绑定笔记 = 选位置绑定文件;已绑定 = 迁到新位置重新绑定
                    (正文引用的 assets 图片随迁);失联笔记 = 自救重新落盘 */}
                <IconTip label="另存为 / 绑定到文件:选位置写盘并重新绑定,图片随迁(Ctrl+Shift+S)">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={onNoteSaveAs}
                    aria-label="另存为"
                  >
                    <Save />
                  </Button>
                </IconTip>
                {/* 导出:三种格式进下拉;FileSymlink 箭头向右穿出文件,
                    与侧栏 FileInput/FolderInput(箭头指入)构成导入/导出一对。
                    IconTip 必须包在 DropdownMenu 内、套住 Trigger:
                    DropdownMenu Root 是纯 Context 不渲染 DOM,包在外面
                    TooltipTrigger 的 asChild 会静默失效 */}
                <DropdownMenu>
                  <IconTip label="导出笔记:Markdown / HTML / PDF">
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
                  </IconTip>
                  {/* 基类把菜单宽度锁在触发按钮宽度,导出条目文本长,抬个下限防换行 */}
                  <DropdownMenuContent
                    align="end"
                    style={{ minWidth: '12rem' }}
                    onPointerDown={() => {
                      exportMenuPointerDown.current = true
                    }}
                    onCloseAutoFocus={(e) => {
                      if (exportMenuPointerDown.current) {
                        exportMenuPointerDown.current = false
                        e.preventDefault()
                      }
                    }}
                  >
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
            {/* 绑定文件在磁盘上消失(外部删除/移动):提示但不阻塞编辑,写回会重建;
                另存为 = 选新位置重新绑定(自救),删除 = 移除笔记(不碰磁盘) */}
            {fileMissing && (
              <div className="flex shrink-0 items-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                <FileWarning className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">绑定文件已在磁盘上消失(被外部删除或移动);继续编辑将重建文件。</span>
                <Button variant="ghost" size="xs" onClick={onNoteSaveAs}>
                  另存为…
                </Button>
                {/* ghost 无 destructive 文本色变体,仅保留这一个覆盖 */}
                <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={onNoteDelete}>
                  删除笔记
                </Button>
              </div>
            )}
            {view === 'split' ? (
              <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <EditorPane
                    key={active.id}
                    value={active.content}
                    onChange={(v) => updateNote(active.id, v)}
                    bindScroller={bindEditorScroller}
                    noteDir={active.sourcePath ? active.sourcePath.replace(/[\\/][^\\/]*$/, '') : null}
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
                  noteDir={active.sourcePath ? active.sourcePath.replace(/[\\/][^\\/]*$/, '') : null}
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
            <p className="text-sm text-muted-foreground">选择左侧笔记，或新建一篇笔记</p>
            <Button onClick={() => createNote()}>
              <Plus /> 新建笔记
            </Button>
          </div>
        )}
          </main>
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      {children}
      <Toaster />
    </div>
    </TooltipProvider>
  )
}

