import { type ReactElement, type ReactNode, useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue } from 'motion/react'
import type { AnimationPlaybackControls, Transition } from 'motion/react'
import { IconLayoutColumns, IconEye, IconFileCode2, IconFileExport, IconFileText, IconFileAlert, IconPhotoPlus, IconBrush, IconPalette, IconLayoutSidebar, IconWriting, IconPlus, IconPrinter, IconSettings, IconSparkles } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Toaster } from '@/components/ui/sonner'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Sidebar } from '@/components/Sidebar'
import { SidebarResizeHandle } from '@/components/SidebarResizeHandle'
import { GlowResizeHandle } from '@/components/GlowResizeHandle'
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '@/app/workspace-preferences'
import { WindowControls } from '@/components/WindowControls'
import { SettingsSheet } from '@/components/SettingsSheet'
import { EditorPane } from '@/components/EditorPane'
import { LiveEditorPane } from '@/components/LiveEditorPane'
import { PreviewPane } from '@/components/PreviewPane'
import { Tip } from '@/components/Tip'
import { fromNow } from '@/lib/time'
import { cn } from '@/lib/utils'
import { countImages, countWords } from '@/modules/notebook/domain/note'
import { appEvents } from '@/shared/events/app-events'
import { noteDirOf } from '@/shared/paths'
import type { Note } from '@/modules/notebook/domain/note'
import type { ThemeFile } from '@/lib/theme/schema'
import type { EditorViewMode } from '@/store-editor'
export type ViewMode = EditorViewMode
const FOLLOW_GLOBAL = '__follow__'
/* 视图分段控件:灰底轨道 + 选中浮起胶囊。选中态不能用 data-[state=on]: 写——
   外层 IconTip 的 TooltipTrigger asChild 会把它的 data-state(closed/open)覆写到
   按钮上,顶掉 Radix Toggle 的 on/off;本版 Toggle 也不设 aria-pressed。
   故直接按受控的 view 条件加类 */
const VIEW_ORDER: ViewMode[] = ['live', 'edit', 'split', 'preview']
/* 尺寸与下方类名硬对应:item w-7(28px)+ spacing 1.5(6px) → 步长 34px,
   供滑动胶囊算平移;改尺寸时两处同步 */
const VIEW_ITEM_W = 28
const VIEW_ITEM_STEP = 34
const VIEW_ITEM_CLS = 'relative h-6 w-7 min-w-7 px-0 rounded text-muted-foreground hover:bg-transparent'
const VIEW_ITEM_ON = 'text-foreground'
/* 基类带 hover:text-foreground,未选中项不锁住的话 hover 会提亮图标 */
const VIEW_ITEM_OFF = 'hover:text-muted-foreground'
/* 侧栏折叠/展开动画:200ms ease-out,与顶栏视图胶囊同一动效语言 */
const SIDEBAR_SLIDE_TRANSITION: Transition = { duration: 0.2, ease: 'easeOut' }
/* 顶栏图标按钮的悬停提示:统一走 Tip(替代原生 title 的项目级封装),固定向下弹出 */
function IconTip({ label, children }: { label: string; children: ReactElement }) { return <Tip label={label} side="bottom">{children}</Tip> }
export interface AppShellProps { active: Note | null; allThemes: ThemeFile[]; noteThemeLabel: string; view: ViewMode; setView: (view: ViewMode) => void; previewText: string; sidebarCollapsed: boolean; onSidebarExpand: () => void; sidebarWidth: number; onSidebarWidthCommit: (px: number) => void; settingsOpen: boolean; setSettingsOpen: (open: boolean) => void; setStudioOpen: (open: boolean) => void; updateNote: (id: string, content: string) => void; createNote: () => void; setNoteTheme: (id: string, themeId: string | null) => void; exportPdf: () => void; exportNoteFile: (kind: 'md' | 'html') => void; fileMissing: boolean; onNoteDelete: () => void; bindEditorScroller: (element: HTMLElement | null) => void; bindPreviewScroller: (element: HTMLElement | null) => void; children?: ReactNode }
export function AppShell({ active, allThemes, noteThemeLabel, view, setView, previewText, sidebarCollapsed, onSidebarExpand, sidebarWidth, onSidebarWidthCommit, settingsOpen, setSettingsOpen, setStudioOpen, updateNote, createNote, setNoteTheme, exportPdf, exportNoteFile, fileMissing, onNoteDelete, bindEditorScroller, bindPreviewScroller, children }: AppShellProps) {
  const imageCount = active ? countImages(active.content) : 0
  /* 活动笔记所在目录:三个编辑器视图共用的插图落盘基准(paths 工具单一来源) */
  const activeNoteDir = active ? noteDirOf(active.sourcePath) : null
  /* 侧栏折叠动画(motion 命令式,与拖拽架构共生):
     clipWidth = 外层裁剪窗宽,折叠/展开由 animate() 补间;
     contentWidth = 内层内容宽,滑出前冻结一次,动画过程内容不逐帧重排。
     两者同时是拖拽的数值源——handle 经 writeWidth 直写 .set()(绕开 React),
     拖拽提交进 state 后走下方同步分支,为空操作,不会触发 motion 重播动画。
     声明式 animate={{ width }} 不可用:提交会从 motion 内部陈旧值重播动画 */
  const clipWidth = useMotionValue(sidebarWidth)
  const contentWidth = useMotionValue(sidebarWidth)
  /* sidebarMounted = DOM 是否存在:折叠动画完成后才卸载(保留原卸载语义),
     sidebarCollapsed 只表示目标态。展开由下方展开按钮的 onClick 先行
     置回 mounted(事件处理器内 setState),collapsed 目标态交回 App——
     若将来新增展开入口,必须同样先置 mounted,否则侧栏无法重新挂载 */
  const [sidebarMounted, setSidebarMounted] = useState(true)
  const sidebarAnimRef = useRef<AnimationPlaybackControls | null>(null)
  const collapsedRef = useRef(sidebarCollapsed)
  useEffect(() => {
    const wasCollapsed = collapsedRef.current
    collapsedRef.current = sidebarCollapsed
    if (sidebarCollapsed) {
      if (!sidebarMounted) return
      let cancelled = false
      // 冻结内容宽后窗口滑向 0,内容保持完整不逐帧换行
      contentWidth.set(clipWidth.get())
      sidebarAnimRef.current?.stop()
      const controls = animate(clipWidth, 0, SIDEBAR_SLIDE_TRANSITION)
      sidebarAnimRef.current = controls
      void controls.then(() => {
        // 双重守卫:收起途中被展开则不卸载;展开动画已接管同样跳过
        if (!cancelled && collapsedRef.current && sidebarAnimRef.current === controls) {
          setSidebarMounted(false)
        }
      })
      return () => {
        cancelled = true
      }
    }
    if (!wasCollapsed) {
      // 展开态下的宽度同步(偏好异步水合/拖拽提交):直接落位,不做动画
      clipWidth.set(sidebarWidth)
      contentWidth.set(sidebarWidth)
      return
    }
    // 展开:内容按全宽渲染,窗口从当前宽(0 或收起中途)滑到目标宽。
    // effect 在 DOM 提交后执行,motion.div 已挂载,直接启动;
    // 不经 requestAnimationFrame 门控——后台窗口 rAF 冻结会把宽度卡在 0
    contentWidth.set(sidebarWidth)
    sidebarAnimRef.current?.stop()
    sidebarAnimRef.current = animate(clipWidth, sidebarWidth, SIDEBAR_SLIDE_TRANSITION)
  }, [sidebarCollapsed, sidebarMounted, sidebarWidth, clipWidth, contentWidth])
  /* 弹层内发生过指针按下 → 关闭时不让 Radix 把焦点还给触发器:
     那次还焦点会继承列表项的 :focus-visible,触发器常驻聚焦环,
     且 tooltip focus 守卫把它当键盘焦点放行 → tooltip 常驻 */
  const themeSelectPointerDown = useRef(false)
  const exportMenuPointerDown = useRef(false)
  return (
    /* Provider 包整个根:顶栏左侧的"展开侧栏"按钮(仅折叠时渲染)也在 Tooltip
       作用域内,否则一折叠就 Tooltip 脱离 Provider 导致 React 崩溃白屏 */
    <TooltipProvider delayDuration={300}>
    {/* 主页根节点:返回主页时的对称入场动画(主题工厂侧在 App.tsx);应用冷启动也走一次轻淡入 */}
    <div className="flex h-full animate-in fade-in-0 zoom-in-98 duration-200 ease-out">
      {/* 侧栏是固定像素宽的普通 flex 区块,不参与 react-resizable-panels:
          百分比引擎靠 JS 追赶校正,窗口缩放时浏览器先按旧百分比画脏帧
          导致内容抖动;纯 CSS 像素宽由布局层逐帧保证,零 JS 参与。 */}
      {sidebarMounted && (
        <>
          {/* 外层是裁剪窗(动画补间宽),内层固定内容宽防滑动过程逐帧重排;
              拖拽时两者同步直写,内容实时回流如旧 */}
          <motion.div style={{ width: clipWidth }} className="h-full shrink-0 overflow-hidden">
            <motion.div style={{ width: contentWidth }} className="h-full">
              <Sidebar />
            </motion.div>
          </motion.div>
          <SidebarResizeHandle
            readWidth={() => clipWidth.get()}
            writeWidth={(px) => {
              // 拖拽/键盘抢占进行中的折叠/展开动画:必须用 jump 落值——
              // 动画未停时 set 会被动画渲染覆盖;jump 语义即「终止动画并直落」。
              // 同时清空动画引用,让退出动画的 then 守卫(ref 比对)失配,
              // 不会在拖拽中途误卸载;松手提交后 effect 自行恢复收起/同步
              clipWidth.jump(px)
              contentWidth.jump(px)
              sidebarAnimRef.current = null
            }}
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
                  onClick={() => {
                    // 先恢复挂载使侧栏以 0 宽进场滑开;collapsed 目标态交回 App
                    setSidebarMounted(true)
                    onSidebarExpand()
                  }}
                  aria-label="展开侧栏"
                >
                  <IconLayoutSidebar className="size-[18px]" />
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
                {/* —— 视图组(最左):实时/编辑/分屏/预览,纯图标减密度,悬停看含义 —— */}
                <ToggleGroup
                  type="single"
                  variant="default"
                  size="sm"
                  spacing={1.5}
                  className="relative rounded-md bg-muted p-1"
                  value={view}
                  onValueChange={(v) => {
                    if (v) setView(v as ViewMode)
                  }}
                >
                  {/* 滑动胶囊:选中态的唯一视觉载体,按钮本身只换图标颜色 */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-1 left-1 rounded bg-background shadow-sm transition-transform duration-200 ease-out"
                    style={{ width: VIEW_ITEM_W, transform: `translateX(${Math.max(0, VIEW_ORDER.indexOf(view)) * VIEW_ITEM_STEP}px)` }}
                  />
                  <IconTip label="实时预览">
                    <ToggleGroupItem value="live" aria-label="实时预览" className={cn(VIEW_ITEM_CLS, view === 'live' ? VIEW_ITEM_ON : VIEW_ITEM_OFF)}>
                      <IconSparkles className="size-4" />
                    </ToggleGroupItem>
                  </IconTip>
                  <IconTip label="编辑视图">
                    <ToggleGroupItem value="edit" aria-label="编辑视图" className={cn(VIEW_ITEM_CLS, view === 'edit' ? VIEW_ITEM_ON : VIEW_ITEM_OFF)}>
                      <IconWriting className="size-4" />
                    </ToggleGroupItem>
                  </IconTip>
                  <IconTip label="分屏视图">
                    <ToggleGroupItem value="split" aria-label="分屏视图" className={cn(VIEW_ITEM_CLS, view === 'split' ? VIEW_ITEM_ON : VIEW_ITEM_OFF)}>
                      <IconLayoutColumns className="size-4" />
                    </ToggleGroupItem>
                  </IconTip>
                  <IconTip label="预览视图">
                    <ToggleGroupItem value="preview" aria-label="预览视图" className={cn(VIEW_ITEM_CLS, view === 'preview' ? VIEW_ITEM_ON : VIEW_ITEM_OFF)}>
                      <IconEye className="size-4" />
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
                      size="sm"
                      className="relative h-8 w-8 justify-center border-none bg-transparent px-0 shadow-none hover:bg-accent [&>svg:last-child]:hidden dark:bg-transparent"
                      aria-label={noteThemeLabel}
                    >
                      <IconPalette className="size-[18px] shrink-0" />
                      {active.themeId && (
                        <span
                          aria-hidden
                          className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
                        />
                      )}
                    </SelectTrigger>
                  </IconTip>
                  {/* 图标触发器没有 SelectValue:Radix item-aligned 定位依赖
                      valueNode,缺失时下拉会渲染到视口外(body 末尾)——因此
                      这里必须显式 popper(锚定触发器),并撑到触发器宽度 */}
                  <SelectContent
                    position="popper"
                    className="min-w-(--radix-select-trigger-width)"
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
                    <IconPhotoPlus className="size-[18px]" />
                  </Button>
                </IconTip>
                {/* 导出:三种格式进下拉;IconFileExport 箭头向右穿出文件,
                    与主题工厂 IconFileImport/侧栏 IconFolderDown(箭头指入)构成导入/导出一对。
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
                        <IconFileExport className="size-[18px]" />
                      </Button>
                    </DropdownMenuTrigger>
                  </IconTip>
                  {/* 基类把菜单宽度锁在触发按钮宽度(w-(--radix-dropdown-menu-trigger-width));导出条目文本长,这里松绑为随内容自适应,tailwind-merge 会覆盖掉基类 w */}
                  <DropdownMenuContent
                    align="end"
                    className="w-fit"
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
                      <IconFileText />
                      导出 Markdown (.md)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void exportNoteFile('html')}>
                      <IconFileCode2 />
                      导出 HTML (.html)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportPdf}>
                      <IconPrinter />
                      导出 PDF
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
                    <IconBrush className="size-[18px]" />
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
                    <IconSettings className="size-[18px]" />
                  </Button>
                </IconTip>
              </>
            )}
            <WindowControls />
            </div>
        </header>

        {active ? (
          <>
            {/* 绑定文件在磁盘上消失(外部删除/移动):提示但不阻塞编辑;
                自救 = 继续编辑写回重建文件,删除 = 移除笔记(不碰磁盘) */}
            {fileMissing && (
              <div className="flex shrink-0 items-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                <IconFileAlert className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">绑定文件已在磁盘上消失(被外部删除或移动);继续编辑将重建文件。</span>
                {/* ghost 无 destructive 文本色变体,仅保留这一个覆盖 */}
                <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={onNoteDelete}>
                  删除笔记
                </Button>
              </div>
            )}
            {/* 懒加载:正文未从磁盘读回前编辑器不挂载——CodeMirror 的 value
                永远是已加载内容,杜绝「空内容编辑 → 覆盖磁盘文件」 */}
            {active.contentLoaded === false ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                <Spinner className="size-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">正在读取笔记…</p>
              </div>
            ) : view === 'split' ? (
              <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
                <ResizablePanel defaultSize="50%" minSize="20%">
                  <EditorPane
                    key={active.id}
                    value={active.content}
                    onChange={(v) => updateNote(active.id, v)}
                    bindScroller={bindEditorScroller}
                    noteDir={activeNoteDir}
                  />
                </ResizablePanel>
                <GlowResizeHandle withHandle />
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
                  noteDir={activeNoteDir}
                />
              </div>
            ) : view === 'live' ? (
              <div className="min-h-0 flex-1">
                <LiveEditorPane
                  key={active.id}
                  value={active.content}
                  onChange={(v) => updateNote(active.id, v)}
                  noteThemeId={active.themeId}
                  noteDir={activeNoteDir}
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
              <IconPlus /> 新建笔记
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

