import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'highlight.js/styles/github.css'
import {
  IconArrowLeft,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconCrosshair,
  IconFileCode2,
  IconFileImport,
  IconJson,
  IconFileExport,
  IconFileText,
  IconFolderOpen,
  IconFocusCentered,
  IconLuggage,
  IconDots,
  IconPencil,
  IconPlus,
  IconRotate2,
  IconTrash,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'motion/react'
import { platformServices } from '@/app/platform'

import { Button } from '@/components/ui/button'
import { AutoHideScrollArea } from '@/components/AutoHideScrollArea'
import { Badge } from '@/components/ui/badge'
import { ImageLightbox } from '@/components/ImageLightbox'
import { collectLightboxState, type LightboxSlide } from '@/lib/image-lightbox-state'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { GlowResizeHandle } from '@/components/GlowResizeHandle'
import { Spinner } from '@/components/ui/spinner'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Tip } from '@/components/Tip'
import { WindowControls } from '@/components/WindowControls'
import { CssEditorPanel } from '@/components/theme/CssEditorPanel'
import { FieldRow } from '@/components/theme/FieldControls'
import { ColorFieldRow } from '@/components/theme/FieldControls'
import { LiveEditorPane } from '@/components/LiveEditorPane'
import { NotePicker } from '@/components/theme/NotePicker'
import { useExtraCss } from '@/components/theme/useExtraCss'
import { compileTokens, } from '@/lib/theme/compile'
import { importThemeCss } from '@/lib/theme/css-io'
import { PORTABLE_TARGETS, buildPortableCss, portableCssFileName, type PortableCssTarget } from '@/lib/theme/portable-css'
import { ELEMENTS, ELEMENT_GROUPS, elementTokenKeys } from '@/lib/theme/elements'
import { FOCUSED_SAMPLES } from '@/lib/theme/element-samples'
import { TOKEN_VAR } from '@/lib/theme/tokens'
import type { FieldDef } from '@/lib/theme/elements'
import { resolveFallbackColors, resolveFallbackFonts } from '@/lib/theme/color-fallbacks'
import { inspectElementId } from '@/lib/theme/inspect'
import { renderStaticHtml } from '@/modules/rendering/static-html'
import { buildCodeButtons } from '@/modules/rendering/codeblock-chrome'
import { useEditorPrefs } from '@/store-editor'
import { SAMPLE_DOC } from '@/lib/theme/sample'
import { setActiveNoteDir } from '@/lib/image-src'
import type { ThemeFile } from '@/lib/theme/schema'
import type { ThemeTokens, TokenKey } from '@/lib/theme/tokens'
import {
  BUILTIN_THEMES,
  listAllThemes,
  useThemeStore,
} from '@/store-themes'
import { notebookController, useNotebook } from '@/store'
import { useAppearance } from '@/store-appearance'
import { cn } from '@/lib/utils'
import { FieldLegend, FieldSet } from '@/components/ui/field'

/**
 * 主题工场：左=主题库+元素导航，中=预览（专注样例/全内容样例/导入笔记），
 * 右=属性面板。UI 完全由 lib/theme/elements.ts 的元数据生成。
 * 所有主题就地修改；内置主题改动时 store 自动先复制为副本。
 */

/** 顶栏右侧图标按钮的悬停提示（与主页 AppShell 同款结构） */
function IconTip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

/** 导出走平台 saveText:原生保存对话框选目录 + 落盘(浏览器 blob 下载在 Tauri webview 静默无效) */
async function downloadFile(input: { defaultName: string; contents: string; filterName: string; extensions: string[] }) {
  const result = await platformServices.files.saveText(input)
  if (result.kind === 'saved') toast.success(`已保存到 ${result.path}`)
}

/** 中栏预览模式:专注样例跟随左侧选中元素;全内容样例是标准完整文档;导入 = 工作区笔记副本(可编辑) */
type PreviewMode = 'focused' | 'full' | 'imported'

/**
 * 预览模式 Tabs 的滑动高亮:shadcn(Radix 版)Tabs 的高亮底色长在 trigger 自身
 * (data-active:bg-background),换页只能瞬切。这里把静态底色关掉,改由激活
 * trigger 内渲染同一枚 layoutId 游标片,motion 在切换时自动把它从旧位置滑到
 * 新位置。isolate + -z-10 让游标垫在图标/文字之下、又浮在 TabsList 的 muted
 * 底之上;游标样式复刻原 data-active 观感(bg-background 阴影,dark 为描边半透)。
 */
const PREVIEW_TRIGGER_CLASS =
  'isolate px-2.5 text-xs font-normal data-active:bg-transparent group-data-[variant=default]/tabs-list:data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent'

function PreviewModePill() {
  return (
    <motion.span
      layoutId="theme-studio-preview-mode-pill"
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className="absolute inset-0 -z-10 rounded-md border border-transparent bg-background shadow-sm dark:border-input dark:bg-input/30"
    />
  )
}

export function ThemeStudio({ onBack }: { onBack: () => void }) {
  const themes = useThemeStore((s) => s.themes)
  const activeId = useThemeStore((s) => s.activeId)
  const setActive = useThemeStore((s) => s.setActive)
  const isDark = useAppearance((s) => s.isDark)
  const updateTokens = useThemeStore((s) => s.updateTokens)
  const setExtraCss = useThemeStore((s) => s.setExtraCss)
  const duplicateTheme = useThemeStore((s) => s.duplicateTheme)
  const renameTheme = useThemeStore((s) => s.renameTheme)
  const removeTheme = useThemeStore((s) => s.removeTheme)
  const importTheme = useThemeStore((s) => s.importTheme)
  const upsertTheme = useThemeStore((s) => s.upsertTheme)

  // 工场里正在编辑的主题（不等于激活预览的主题；默认跟随激活，可单独选）
  const [editId, setEditId] = useState<string | null>(null)
  const editingId = editId ?? activeId
  const editing =
    listAllThemes({ themes, activeId }).find((t) => t.id === editingId) ?? BUILTIN_THEMES[0]

  const [selectedElement, setSelectedElement] = useState('root')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const activeTokens = editing.tokens

  // 中栏预览:专注样例(默认)/全内容样例/导入的工作区笔记
  const [previewMode, setPreviewMode] = useState<PreviewMode>('focused')
  // 导入模式:选中的工作区笔记 id 与其内容副本(本地编辑,不写回源文件)
  const notes = useNotebook((s) => s.notes)
  const [importedNoteId, setImportedNoteId] = useState<string | null>(null)
  const [importedDoc, setImportedDoc] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  /** 待载入正文的笔记 id:选择后经 effect 等正文懒加载完成再填充副本 */
  const pendingImportRef = useRef<string | null>(null)
  const importedNote = notes.find((n) => n.id === importedNoteId) ?? null

  const [cssOpen, setCssOpen] = useState(false)
  const [inspectMode, setInspectMode] = useState(false)

  const jsonInputRef = useRef<HTMLInputElement>(null)

  const element = ELEMENTS.find((e) => e.id === selectedElement) ?? ELEMENTS[0]

  // 选择工作区笔记 → 复制内容为编辑副本。正文懒加载未读盘的笔记先 ensureNoteContentLoaded,
  // 读盘完成后 store 更新,effect 再次执行填充副本
  const pickImportedNote = useCallback((id: string) => {
    pendingImportRef.current = id
    setImportedNoteId(id)
    setImportedDoc(null)
  }, [])
  useEffect(() => {
    const id = pendingImportRef.current
    if (!id) return
    const note = notes.find((n) => n.id === id)
    if (!note) {
      pendingImportRef.current = null
      setImportedNoteId(null)
      toast.error('该笔记已不存在,请重新选择')
      return
    }
    if (note.contentLoaded === false) {
      notebookController.ensureNoteContentLoaded(note.id)
      return
    }
    pendingImportRef.current = null
    setImportedDoc(note.content)
  }, [notes, importedNoteId])

  // 导入绑定磁盘文件的笔记时,其 assets/ 相对路径要按它自己的目录解析;
  // 离开导入预览(切模式/换笔记/卸载)把解析基准还给主界面的活动笔记
  const importedNotePath = importedNote?.sourcePath
  useEffect(() => {
    if (previewMode !== 'imported' || !importedNotePath) return
    setActiveNoteDir(importedNotePath)
    return () => {
      const { activeId: currentId, notes: currentNotes } = notebookController.getSnapshot()
      setActiveNoteDir(currentNotes.find((n) => n.id === currentId)?.sourcePath)
    }
  }, [previewMode, importedNotePath])

  // 回落色预览:从中栏预览实测各颜色项未设置时的实际观感色。
  // 依赖令牌/元素/明暗编辑态/预览内容,变化后重测(浏览器渲染完成后测量,保证拿到的是最新样式)
  const previewHostRef = useRef<HTMLDivElement | null>(null)
  const [fallbackColors, setFallbackColors] = useState<Record<string, string | undefined>>({})
  const [fallbackFonts, setFallbackFonts] = useState<Record<string, string | undefined>>({})
  const colorKeys = useMemo(
    () => element.fields.filter((f) => f.type === 'color').map((f) => f.key),
    [element],
  )
  const fontKeys = useMemo(
    () => element.fields.filter((f) => f.type === 'font-family').map((f) => f.key),
    [element],
  )
  useEffect(() => {
    // 防抖 150ms 后再测量(双 rAF 确保样式已应用)。
    // 拖动取色器时令牌每帧变化,每帧批量 getComputedStyle 会强制同步布局,卡顿明显
    let raf2 = 0
    const timer = setTimeout(() => {
      raf2 = requestAnimationFrame(() => {
        const root = previewHostRef.current?.querySelector('.themd-prose')
        if (!root) return
        const measured = resolveFallbackColors(
          root as HTMLElement,
          colorKeys as never,
        ) as Record<string, string | undefined>
        // 值未变化时跳过 setState,避免无谓的全树重渲染
        setFallbackColors((prev) => {
          const same =
            Object.keys(prev).length === Object.keys(measured).length &&
            colorKeys.every((k) => prev[k] === measured[k])
          return same ? prev : measured
        })
        const fontMeasured = resolveFallbackFonts(
          root as HTMLElement,
          fontKeys as never,
        ) as Record<string, string | undefined>
        setFallbackFonts((prev) => {
          const same =
            Object.keys(prev).length === Object.keys(fontMeasured).length &&
            fontKeys.every((k) => prev[k] === fontMeasured[k])
          return same ? prev : fontMeasured
        })
      })
    }, 150)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf2)
    }
  }, [colorKeys, fontKeys, editing, isDark, selectedElement, previewMode, importedDoc])

  // 拖动取色器的「绝对流畅」路径:令牌键 → CSS 变量名,直写预览容器的 style,
  // 不经过 React 渲染;松手 200ms 后 commit 走正常 store 提交(持久化+状态归位)。
  // 两个回调用 useCallback 永久稳定(内部经 implRef 间接调用最新实现),不破坏子组件 memo。
  const livePreviewImplRef = useRef<(field: FieldDef, v: string) => void>(() => {})
  const commitImplRef = useRef<(field: FieldDef, v: string) => void>(() => {})
  const livePreviewColor = useCallback(
    (field: FieldDef, v: string) => livePreviewImplRef.current(field, v),
    [],
  )
  const commitColor = useCallback(
    (field: FieldDef, v: string) => commitImplRef.current(field, v),
    [],
  )

  const setToken = (key: TokenKey, value: string | undefined) => {
    const next: ThemeTokens = { ...editing.tokens }
    if (value === undefined) delete next[key]
    else next[key] = value
    const realId = updateTokens(editing.id, next)
    // 内置主题被复制后，跟随到副本继续编辑
    if (realId !== editing.id) setEditId(realId)
  }

  // 稳定回调:memo 化的 FieldRow/ColorFieldRow 依赖引用相等跳过重渲染,
  // 每次渲染新建函数会让 memo 失效(拖动取色器时 80+ 控件全量重渲染 = 卡顿主因)
  const setTokenRef = useRef(setToken)
  const setTokenStable = useRef((key: TokenKey, value: string | undefined) =>
    setTokenRef.current(key, value),
  ).current
  useEffect(() => {
    setTokenRef.current = setToken
    livePreviewImplRef.current = (field, v) => {
      // app.* 画布类令牌的消费点不是 .themd-prose,是滚动容器(React 内联样式),
      // 实时直写容器 background;正文类令牌直写 CSS 变量
      if (field.key === 'app.bg') {
        const canvas = previewHostRef.current?.querySelector('[data-app-canvas]') as HTMLElement | null
        canvas?.style.setProperty('background', v)
        return
      }
      const varName = TOKEN_VAR[field.key as TokenKey]
      if (!varName) return
      ;(previewHostRef.current?.querySelector('.themd-prose') as HTMLElement | null)?.style.setProperty(
        varName,
        v,
      )
    }
    commitImplRef.current = (field, v) => setTokenRef.current(field.key as TokenKey, v)
  })

  const resetElement = () => {
    const next: ThemeTokens = { ...editing.tokens }
    for (const k of elementTokenKeys(element.id)) delete next[k]
    updateTokens(editing.id, next)
  }

  const applyExtraCss = (css: string) => {
    const realId = setExtraCss(editing.id, css)
    if (realId !== editing.id) setEditId(realId)
  }

  const handleExportJson = () => {
    const content = JSON.stringify(
      { version: 1, id: editing.id, name: editing.name, tokens: editing.tokens, extraCss: editing.extraCss },
      null,
      2,
    )
    void downloadFile({
      defaultName: `${editing.name}.themd.json`,
      contents: content,
      filterName: '主题包',
      extensions: ['json'],
    })
  }

  // 可移植样式包:theme-base 全文 + 令牌内联,贴到 Typora/VSCode/GitHub 复现观感
  const handleExportPortable = (target: PortableCssTarget) => {
    void downloadFile({
      defaultName: portableCssFileName(editing.name, target),
      contents: buildPortableCss(editing, target),
      filterName: 'CSS',
      extensions: ['css'],
    })
  }

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    if (/\.css$/i.test(file.name)) {
      // CSS 导入:映射令牌 + 附加 CSS + 报告
      const target: { tokens: ThemeTokens; extraCss?: string } = { tokens: {} }
      const report = importThemeCss(text, target)
      const id = crypto.randomUUID()
      upsertTheme({
        version: 1,
        id,
        name: file.name.replace(/\.css$/i, ''),
        tokens: target.tokens,
        extraCss: target.extraCss,
      })
      // 导入即激活:带进来的是成品样式,意图就是使用;只挂列表会造成
      // 「预览已是它、徽章还钉在旧主题」的割裂(导入者视角=已在使用)
      setActive(id)
      setEditId(id)
      toast.success(
        `导入完成:映射 ${report.mapped} 条声明,附加 CSS ${report.extra} 条,跳过 ${report.skipped} 条`,
        { duration: 6000 },
      )
      return
    }
    const id = importTheme(text)
    if (id) {
      setActive(id)
      setEditId(id)
      toast.success(`已导入「${file.name.replace(/\.themd\.json$/i, '')}」`)
    } else {
      toast.error('导入失败:不是有效的主题文件')
    }
  }

  const handleCreate = () => {
    const id = crypto.randomUUID()
    upsertTheme({ version: 1, id, name: `我的主题 ${themes.length + 1}`, tokens: {} })
    // 只把新主题加进列表,不动预览/编辑对象——预览跟随「正在编辑」,
    // 这里若切 editId,用户正在看的主题预览会被强行换成一张白纸(观感=被应用了);
    // 激活同理(见 copy/import 的不变式)。编辑新主题 = 点它那一行。
  }

  // 中栏预览文稿:专注样例跟随左侧选中元素,全内容样例固定,导入模式用编辑副本
  const previewDoc =
    previewMode === 'focused'
      ? (FOCUSED_SAMPLES[selectedElement] ?? element.label)
      : previewMode === 'full'
        ? SAMPLE_DOC
        : importedDoc

  const handleInspect = (id: string) => {
    setSelectedElement(id)
    setInspectMode(false)
    toast(`已定位到「${ELEMENTS.find((e) => e.id === id)?.label ?? id}」`)
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex h-full w-full flex-1 flex-col">
      {/* 顶栏 */}
      <header
        data-tauri-drag-region
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4"
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="font-normal" onClick={onBack}>
            <IconArrowLeft /> 返回
          </Button>
          <span data-tauri-drag-region className="text-sm font-semibold">
            主题工场
          </span>
        </div>
        {/* 右上角与主页同款:ghost 图标按钮 + 悬停提示 */}
        <div className="flex items-center gap-2">
          <IconTip label="导入主题包(.themd.json)或 CSS 文件">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => jsonInputRef.current?.click()}
              aria-label="导入"
            >
              {/* IconFileImport:箭头指入文件=收进来,与主页/侧栏导入语言一致 */}
              <IconFileImport className="size-[18px]" />
            </Button>
          </IconTip>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,.themd.json,.css"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleImportFile(f)
              e.target.value = ''
            }}
          />
          <DropdownMenu>
            {/* IconTip 必须包在 DropdownMenu 内、套住 Trigger:DropdownMenu Root 是
                纯 Context 不渲染 DOM,包在外面 TooltipTrigger 的 asChild 会静默失效 */}
            <IconTip label="导出主题包 / 可移植样式包">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label="导出">
                  {/* IconFileExport:主页导出笔记同款(箭头穿出文件),与 IconFileImport 构成一对 */}
                  <IconFileExport className="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
            </IconTip>
            {/* 基类把菜单宽度锁在触发按钮宽度,导出条目文本长,抬个下限防换行(同 AppShell) */}
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem onClick={handleExportJson}>
                <IconJson />
                主题包(.themd.json)
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2">
                  <IconLuggage />
                  可移植样式包(完整 CSS)
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {PORTABLE_TARGETS.map((t) => (
                    <DropdownMenuItem key={t.id} onClick={() => handleExportPortable(t.id)}>
                      <IconFileCode2 />
                      {t.label}
                      <span className="ml-auto text-xs text-muted-foreground">{t.hint}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          <WindowControls />
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        {/* 左栏：主题库 + 元素导航——两个分区各自独立滚动,主题库最多占 45% 高,
            列表多时在自己分区内滚,不把元素导航挤出视野 */}
        <ResizablePanel defaultSize="22%" minSize="14%" maxSize="38%">
          <div className="flex h-full flex-col">
            <ThemeLibrary
              themes={listAllThemes({ themes, activeId })}
              activeId={activeId}
              onSelectPreview={(id) => {
                setActive(id)
                setEditId(id)
              }}
              onSelectEdit={setEditId}
              onDuplicate={(id) => {
                const newId = duplicateTheme(id)
                if (newId) {
                  setEditId(newId)
                  toast.success('已创建副本')
                }
              }}
              onRename={(id, name) => renameTheme(id, name)}
              onDelete={(id) => {
                removeTheme(id)
                if (editing.id === id) setEditId(null)
                toast.success('已删除')
              }}
              onCreate={handleCreate}
            />
            <AutoHideScrollArea className="min-h-0 flex-1">
              <ElementNav
                selected={selectedElement}
                onSelect={setSelectedElement}
                collapsed={collapsedGroups}
                onToggleCollapse={(g) =>
                  setCollapsedGroups((s) => {
                    const next = new Set(s)
                    if (next.has(g)) next.delete(g)
                    else next.add(g)
                    return next
                  })
                }
              />
            </AutoHideScrollArea>
          </div>
        </ResizablePanel>

        <GlowResizeHandle withHandle />

        {/* 中栏：预览(专注样例 / 全内容样例 / 导入笔记) */}
        <ResizablePanel defaultSize="48%" minSize="25%">
          <div className="flex h-full flex-col">
            <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3">
              <div className="flex min-w-0 items-center gap-2">
                <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as PreviewMode)}>
                  {/* shadcn Tabs 默认尺寸偏大,按工具栏场景收一档;基类 h-9 带
                      group-data-horizontal 变体前缀,必须用同前缀才能覆盖掉 */}
                  <TabsList className="group-data-horizontal/tabs:h-8">
                    <TabsTrigger value="focused" className={PREVIEW_TRIGGER_CLASS}>
                      {previewMode === 'focused' && <PreviewModePill />}
                      <IconFocusCentered className="size-4" />
                      专注样例
                    </TabsTrigger>
                    <TabsTrigger value="full" className={PREVIEW_TRIGGER_CLASS}>
                      {previewMode === 'full' && <PreviewModePill />}
                      <IconFileText className="size-4" />
                      全内容样例
                    </TabsTrigger>
                    <TabsTrigger value="imported" className={PREVIEW_TRIGGER_CLASS}>
                      {previewMode === 'imported' && <PreviewModePill />}
                      <IconFileImport className="size-4" />
                      导入笔记
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                {previewMode === 'imported' && notes.length > 0 && (
                  <NotePicker
                    notes={notes}
                    selectedId={importedNoteId}
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    onPick={pickImportedNote}
                  />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* 与顶栏一致的图标按钮密度;开关语义用 shadcn Toggle,
                    按下态由 aria-pressed 驱动(muted 底 + primary 图标);
                    导入模式是渲染态编辑,元素拾取不适用,置灰 */}
                <IconTip
                  label={
                    previewMode === 'imported'
                      ? '导入模式下文稿已实时渲染,直接在文中编辑即可'
                      : '点击预览中的元素,直接跳到它的设置'
                  }
                >
                  <Toggle
                    size="sm"
                    disabled={previewMode === 'imported'}
                    pressed={inspectMode}
                    onPressedChange={setInspectMode}
                    className="size-8 px-0 aria-pressed:text-primary"
                    aria-label="选择元素"
                  >
                    <IconCrosshair className="size-[18px]" />
                  </Toggle>
                </IconTip>
                <IconTip label={`应用「${editing.name}」到笔记预览`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => {
                      setActive(editing.id)
                      toast.success(`已应用「${editing.name}」到笔记预览`)
                    }}
                    aria-label="应用此主题"
                  >
                    <IconCheck className="size-[18px]" />
                  </Button>
                </IconTip>
              </div>
            </div>
            {previewMode === 'imported' ? (
              importedNoteId === null ? (
                <ImportEmptyState
                  hasNotes={notes.length > 0}
                  onOpenPicker={() => setPickerOpen(true)}
                />
              ) : importedDoc === null ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                  <Spinner className="size-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">正在读取笔记…</p>
                </div>
              ) : (
                /* 实时预览编辑(TipTap 渲染态,Typora 式单栏):编辑即所见,
                    消费「正在编辑」的主题令牌,右侧调样式此处实时生效;
                    文稿是本地副本,不写回源文件。key=换笔记重建编辑器 */
                <div className="min-h-0 flex-1" ref={previewHostRef}>
                  <LiveEditorPane
                    key={importedNoteId}
                    value={importedDoc}
                    onChange={setImportedDoc}
                    noteThemeId={editing.id}
                  />
                </div>
              )
            ) : (
              /* 预览直接消费「正在编辑」的主题令牌,应用处于暗色时按暗色编译 */
              <StudioPreview
                theme={editing}
                content={previewDoc ?? ''}
                containerRef={previewHostRef}
                inspect={inspectMode}
                onInspect={handleInspect}
              />
            )}
          </div>
        </ResizablePanel>

        <GlowResizeHandle withHandle />

        {/* 右栏：属性面板(只放调样式的控件)。头/字段/附加 CSS 三段独立：
            头部固定,字段区自己滚,附加 CSS 钉底不随字段滚走 */}
        <ResizablePanel defaultSize="30%" minSize="20%" maxSize="45%">
          <div className="flex h-full flex-col">
            {/* h-14 与中栏头部严格等高 */}
            <div className="flex h-14 shrink-0 items-center justify-between px-4">
              <h2 className="text-sm font-semibold">{element.label}</h2>
              <Button variant="ghost" size="sm" onClick={resetElement} className="font-normal">
                <IconRotate2 /> 恢复默认
              </Button>
            </div>
            <AutoHideScrollArea className="min-h-0 flex-1" viewportProps={{ className: 'px-4 py-2' }}>
              {/* 分区渲染:相邻同 section 字段归入 shadcn FieldSet,FieldLegend 作分区标题
                  (蓝竖条是标题装饰;无 section 的元素整体包进一个无标题 FieldSet,平铺不变) */}
              {(() => {
                const groups: { section?: string; fields: typeof element.fields }[] = []
                for (const f of element.fields) {
                  const last = groups[groups.length - 1]
                  if (last && last.section === f.section) last.fields.push(f)
                  else groups.push({ section: f.section, fields: [f] })
                }
                return groups.map((g, gi) => (
                  <FieldSet key={g.section ?? gi} className={cn('gap-0', gi > 0 && 'mt-4')}>
                    {g.section && (
                      <FieldLegend className="flex items-center gap-1.5 text-[13px] font-semibold leading-none text-foreground/80">
                        <span
                          className="h-3.5 w-1 shrink-0 rounded-full"
                          style={{ background: 'var(--chrome-accent)' }}
                        />
                        {g.section}
                      </FieldLegend>
                    )}
                    {g.fields.map((f) =>
                      f.type === 'color' ? (
                        <ColorFieldRow
                          key={f.key}
                          field={f}
                          value={activeTokens[f.key]}
                          fallbackColor={fallbackColors[f.key]}
                          onChange={(v) => setTokenStable(f.key, v)}
                          onLivePreview={livePreviewColor}
                          onCommit={commitColor}
                        />
                      ) : (
                        <FieldRow
                          key={f.key}
                          field={f}
                          value={activeTokens[f.key]}
                          fallbackFont={fallbackFonts[f.key]}
                          onChange={(v) => setTokenStable(f.key, v)}
                          onLivePreview={f.type === 'background' ? livePreviewColor : undefined}
                          onCommit={f.type === 'background' ? commitColor : undefined}
                        />
                      ),
                    )}
                  </FieldSet>
                ))
              })()}
            </AutoHideScrollArea>

            {/* 附加自定义 CSS（高级模式，P4）——固定在字段区下方,不参与字段区滚动 */}
            <div className="shrink-0 border-t">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => setCssOpen((v) => !v)}
              >
                <span className="text-sm font-semibold">
                  附加 CSS
                  {editing.extraCss && (
                    <span className="ml-1.5 text-xs font-normal text-primary">已自定义</span>
                  )}
                </span>
                {cssOpen ? <IconChevronDown className="size-4" /> : <IconChevronRight className="size-4" />}
              </button>
              {cssOpen && (
                <div className="px-4 pb-4">
                  <CssEditorPanel
                    key={editing.id}
                    themeId={editing.id}
                    value={editing.extraCss}
                    onSave={applyExtraCss}
                  />
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Toaster />
    </div>
    </TooltipProvider>
  )
}

/** 导入模式的空态:引导从工作区选一篇笔记作为预览文稿 */
function ImportEmptyState({
  hasNotes,
  onOpenPicker,
}: {
  hasNotes: boolean
  onOpenPicker: () => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-center">
      <IconFileText className="size-8 text-muted-foreground/50" />
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {hasNotes ? '从工作区选一篇 Markdown 笔记作为预览文稿' : '当前没有笔记——先在主界面打开一个目录工作区'}
        </p>
        {hasNotes && (
          <p className="text-xs text-muted-foreground/70">
            文稿会复制为编辑副本,可边改内容边调样式,不会写回源文件
          </p>
        )}
      </div>
      {hasNotes && (
        <Button variant="outline" size="sm" onClick={onOpenPicker}>
          <IconFolderOpen /> 选择笔记
        </Button>
      )}
    </div>
  )
}

/** 工场中栏预览：与 PreviewPane 同构，但消费指定的主题而非全局激活主题 */
function StudioPreview({
  theme,
  content,
  inspect = false,
  onInspect,
  containerRef,
}: {
  theme: ThemeFile
  content: string
  inspect?: boolean
  onInspect?: (elementId: string) => void
  /** 外部直写 CSS 变量与回落色测量的挂载点(取色器拖动实时预览用) */
  containerRef?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="min-h-0 flex-1" ref={containerRef}>
      <ThemeScopedPreview
        theme={theme}
        content={content}
        inspect={inspect}
        onInspect={onInspect}
      />
    </div>
  )
}

const ThemeScopedPreview = memo(function ThemeScopedPreview({
  theme,
  content,
  inspect = false,
  onInspect,
}: {
  theme: ThemeFile
  content: string
  /** inspect 模式:点击元素回调(配合中栏的「选择元素」开关) */
  inspect?: boolean
  onInspect?: (elementId: string) => void
}) {
  // 渲染统一第 3 步:工厂样例切 TipTap 静态管线(与预览/实时编辑同一 HTML)
  const html = useMemo(() => renderStaticHtml(content), [content])
  const isDark = useAppearance((s) => s.isDark)
  const cssVars = useMemo(
    () => compileTokens(theme.tokens, theme.dark, isDark),
    [theme, isDark],
  )
  useExtraCss(theme.id, theme.extraCss)

  // 代码块 header 交互层按钮注入(与 PreviewPane 同款后处理):
  // 工厂预览也是「应用内」消费方,复制/换行按钮照常可用
  const articleRef = useRef<HTMLElement | null>(null)
  const codeCopyEnabled = useEditorPrefs((s) => s.codeCopyButtonEnabled)
  const codeWrapBtnEnabled = useEditorPrefs((s) => s.codeWrapButtonEnabled)
  useEffect(() => {
    const container = articleRef.current
    if (!container) return
    for (const el of container.querySelectorAll<HTMLElement>('.themd-code')) {
      if (el.dataset.themdChrome) continue
      el.dataset.themdChrome = '1'
      const lang = el.querySelector<HTMLElement>('.themd-code-lang')
      if (!lang) continue
      lang.appendChild(
        buildCodeButtons(
          {
            onToggleWrap: (wrapped) => el.classList.toggle('themd-code-wrap', wrapped),
          },
          { copyButton: codeCopyEnabled, wrapButton: codeWrapBtnEnabled },
        ),
      )
    }
  }, [html, codeCopyEnabled, codeWrapBtnEnabled])

  // 图片灯箱:一次收集预览全部图片,可在灯箱里左右切换;
  // inspect(选择元素)模式下点击仍走元素拾取
  const [lightbox, setLightbox] = useState<{ slides: LightboxSlide[]; index: number } | null>(null)
  const lightboxEnabled = !inspect
  const handleImageClick = (e: React.MouseEvent) => {
    const state = collectLightboxState(e.currentTarget, e.target)
    if (!state) return
    e.preventDefault()
    setLightbox(state)
  }

  // 预览里的 <a> 带真实 href,点击的默认行为是 WebView 直接导航,
  // 会把整个工场页面替换掉——拦截后交系统浏览器打开
  const handleLinkClick = (e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a[href]')
    if (!anchor) return
    e.preventDefault()
    platformServices.files
      .openUrl(anchor.getAttribute('href') ?? '')
      .catch(() => toast.error('打开链接失败'))
  }

  const handleClick = inspect
    ? (e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('.themd-prose')) return
        handleLinkClick(e)
        onInspect?.(inspectElementId(target))
      }
    : (e: React.MouseEvent) => {
        handleLinkClick(e)
        handleImageClick(e)
      }

  return (
    <AutoHideScrollArea
      className={cn(
        'h-full',
        inspect && 'cursor-crosshair [&_*:hover]:outline [&_*:hover]:outline-1 [&_*:hover]:outline-primary/50',
      )}
      // 画布背景铺在滚动容器(正文纸张之外);纸张颜色仍在 article 上
      // data 标记供实时预览直写定位(预览容器在 previewHostRef 内)
      viewportProps={{
        'data-app-canvas': '',
        style: { background: cssVars['--t-app-bg'] },
        onClick: handleClick,
      } as React.ComponentPropsWithoutRef<'div'>}
    >
      <article
        ref={articleRef}
        className="themd-prose mx-auto px-6 py-8"
        style={cssVars as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {lightboxEnabled && (
        <ImageLightbox
          slides={lightbox?.slides ?? []}
          initialIndex={lightbox?.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </AutoHideScrollArea>
  )
})

/** 左栏上部：主题库(标题带 + 独立滚动的列表;列表多时本分区最多占左栏 45% 高) */
function ThemeLibrary(props: {
  themes: ThemeFile[]
  activeId: string
  onSelectPreview: (id: string) => void
  onSelectEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}) {
  const { themes, activeId } = props
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const commitRename = () => {
    if (renamingId && renameValue.trim()) props.onRename(renamingId, renameValue.trim())
    setRenamingId(null)
  }

  return (
    <div className="flex max-h-[45%] shrink-0 flex-col border-b">
      {/* h-14 + text-sm font-semibold 与中/右栏头部同规格,三栏标题成一条线 */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <h2 className="text-sm font-semibold">主题库</h2>
        <IconTip label="新建主题">
          <Button variant="ghost" size="icon" className="size-8" onClick={props.onCreate} aria-label="新建主题">
            {/* IconPlus:应用内「新建」的统一语言(主页新建笔记同款) */}
            <IconPlus className="size-[18px]" />
          </Button>
        </IconTip>
      </div>
      {/* 列表独立滚动。收紧标题与列表间距的负边距必须加在滚动容器(Root)上,
          不能加进视口内容——视口内负 margin 会把首行顶出可滚动范围被裁掉;
          -mt-3 让列表容器贴到头部带下沿(加号按钮底边),首行文字间隙 ~14px */}
      <AutoHideScrollArea className="-mt-3 min-h-0 flex-1">
        <div className="space-y-0.5 px-2 pb-2 pt-0.5">
        {/* 新建/复制/删除主题:进出场高度+淡入过渡,兄弟行由文档流自然推动 */}
        <AnimatePresence initial={false}>
        {themes.map((t) => {
          const menuProps = {
            canRename: !t.builtin,
            canDelete: !t.builtin,
            active: activeId === t.id,
            onUse: () => props.onSelectPreview(t.id),
            onRename: () => {
              setRenamingId(t.id)
              setRenameValue(t.name)
            },
            onDuplicate: () => props.onDuplicate(t.id),
            onDelete: () => props.onDelete(t.id),
          }
          return (
            <ContextMenu key={t.id}>
              {/* 右键行 = 「⋯」菜单同一套操作(Sidebar 笔记/文件夹行同款范式);
                  ContextMenuTrigger 只拦右键,行内左键(编辑/使用/⋯)不受影响;
                  行不再有 hover/选中底色,正在编辑只靠「使用中」tag 表达 */}
              <ContextMenuTrigger asChild>
                {/* 高度动画外壳不得带 padding:py-1.5 的 12px 会垫住 height:0(border-box
                    下 padding 压不掉)——出场收合到 12px 就到底,卸载瞬间消失即「最后一下
                    卡顿」,入场先弹 12px 死区。外壳只管裁切,视觉内边距在内层行上 */}
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="group flex items-center gap-1 px-2 py-1.5 text-sm">
                  <Tip label="编辑此主题">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left"
                      onClick={() => props.onSelectEdit(t.id)}
                    >
                      {t.name}
                    </button>
                  </Tip>
                  {t.builtin && <TagBadge>内置</TagBadge>}
                  {activeId === t.id && <TagBadge tone="primary">使用中</TagBadge>}
                  {activeId !== t.id && (
                    <Button
                      variant="outline"
                      size="xs"
                      className="shrink-0 font-normal"
                      onClick={() => props.onSelectPreview(t.id)}
                    >
                      使用
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 opacity-0 duration-400 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                        aria-label={`主题 ${t.name} 操作`}
                      >
                        <IconDots className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40">
                      <ThemeMenuItems parts={{ Item: DropdownMenuItem, Separator: DropdownMenuSeparator }} {...menuProps} />
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                </motion.div>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-40">
                <ThemeMenuItems parts={{ Item: ContextMenuItem, Separator: ContextMenuSeparator }} {...menuProps} />
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
        </AnimatePresence>
        </div>
      </AutoHideScrollArea>
      {/* 重命名弹窗:侧栏改笔记名称同款。不用内联编辑——菜单关闭后 WebView2
          会程序性抢焦,内联输入框聚焦不可靠;弹窗内 Radix Dialog 自带焦点管理 */}
      <Dialog
        open={renamingId !== null}
        onOpenChange={(open) => !open && setRenamingId(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>重命名主题</DialogTitle>
            <DialogDescription>输入新的主题名称。</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            aria-label="新名称"
            onChange={(e) => setRenameValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenamingId(null)
            }}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={commitRename}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 主题行小标签(内置/使用中):比旁边 xs「使用」按钮(h-6/px-2/text-xs)小一号——h-5.5/px-1.5/text-[11px],圆角与字重同按钮;
    primary = 界面强调色 --chrome-accent 淡底着色(与分区标题竖条/分割线高光同一色彩来源),默认灰色 secondary(内置) */
function TagBadge({ children, tone }: { children: React.ReactNode; tone?: 'primary' }) {
  return (
    <Badge
      variant={tone === 'primary' ? 'ghost' : 'secondary'}
      className="h-5.5 gap-0 rounded-[min(var(--radius-md),8px)] px-1.5 text-[11px] font-normal leading-none"
      style={
        tone === 'primary'
          ? {
              color: 'var(--chrome-accent)',
              background: 'color-mix(in oklch, var(--chrome-accent) 12%, transparent)',
              borderColor: 'color-mix(in oklch, var(--chrome-accent) 30%, transparent)',
            }
          : undefined
      }
    >
      {children}
    </Badge>
  )
}

/** 主题操作项:「⋯」下拉与右键菜单共用一份(Sidebar 同款 parts 模式);
    重命名/删除只对用户主题有意义:内置主题在 BUILTIN_THEMES 静态表里,
    renameTheme/removeTheme 只改 state.themes,对内置点了也是静默无效 */
function ThemeMenuItems({
  parts,
  canRename,
  canDelete,
  active,
  onUse,
  onRename,
  onDuplicate,
  onDelete,
}: {
  parts: { Item: React.ElementType; Separator: React.ElementType }
  canRename: boolean
  canDelete: boolean
  active: boolean
  onUse: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const { Item, Separator } = parts
  return (
    <>
      {!active && (
        <Item onClick={onUse}>
          <IconCheck /> 使用此主题
        </Item>
      )}
      {canRename && (
        <Item onClick={onRename}>
          <IconPencil /> 重命名
        </Item>
      )}
      <Item onClick={onDuplicate}>
        <IconCopy /> 创建副本
      </Item>
      {canDelete && (
        <>
          <Separator />
          <Item variant="destructive" onClick={onDelete}>
            <IconTrash /> 删除
          </Item>
        </>
      )}
    </>
  )
}

/** 左栏下部：元素导航（分组折叠） */
function ElementNav({
  selected,
  onSelect,
  collapsed,
  onToggleCollapse,
}: {
  selected: string
  onSelect: (id: string) => void
  collapsed: Set<string>
  onToggleCollapse: (g: string) => void
}) {
  return (
    <div className="p-2">
      {ELEMENT_GROUPS.map((g) => {
        const items = ELEMENTS.filter((e) => e.group === g.id)
        const isCollapsed = collapsed.has(g.id)
        return (
          <div key={g.id}>
            <button
              type="button"
              className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => onToggleCollapse(g.id)}
            >
              {isCollapsed ? <IconChevronRight className="size-3" /> : <IconChevronDown className="size-3" />}
              {g.label}
            </button>
            {!isCollapsed && (
              <div className="ml-2 space-y-0.5 border-l pl-2">
                {items.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelect(e.id)}
                    className={cn(
                      'list-row-wipe block w-full rounded-md px-2 py-1 text-left text-sm',
                      selected === e.id && 'bg-accent',
                    )}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
