import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'highlight.js/styles/github.css'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Crosshair,
  Download,
  FilePlus2,
  FileUp,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ImageLightbox } from '@/components/ImageLightbox'
import { collectLightboxState, type LightboxSlide } from '@/lib/image-lightbox-state'
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
import { Toaster } from '@/components/ui/sonner'
import { WindowControls } from '@/components/WindowControls'
import { CssEditorPanel } from '@/components/theme/CssEditorPanel'
import { FieldRow } from '@/components/theme/FieldControls'
import { ColorFieldRow } from '@/components/theme/FieldControls'
import { useExtraCss } from '@/components/theme/useExtraCss'
import { compileTokens, } from '@/lib/theme/compile'
import { exportThemeCss, importThemeCss } from '@/lib/theme/css-io'
import { ELEMENTS, ELEMENT_GROUPS, elementTokenKeys } from '@/lib/theme/elements'
import { ELEMENT_SAMPLES } from '@/lib/theme/element-samples'
import { TOKEN_VAR } from '@/lib/theme/tokens'
import type { FieldDef } from '@/lib/theme/elements'
import { resolveFallbackColors } from '@/lib/theme/color-fallbacks'
import { inspectElementId } from '@/lib/theme/inspect'
import { renderMarkdown } from '@/modules/rendering/markdown-renderer'
import { SAMPLE_DOC } from '@/lib/theme/sample'
import type { ThemeFile } from '@/lib/theme/schema'
import type { ThemeTokens, TokenKey } from '@/lib/theme/tokens'
import {
  BUILTIN_THEMES,
  listAllThemes,
  useThemeStore,
} from '@/store-themes'
import { useNotebook } from '@/store'
import { useAppearance } from '@/store-appearance'
import { cn } from '@/lib/utils'

/**
 * 主题工场：左=主题库+元素导航，中=实时预览，右=属性面板。
 * UI 完全由 lib/theme/elements.ts 的元数据生成。
 * 所有主题就地修改；内置主题改动时 store 自动先复制为副本。
 */

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
export function ThemeStudio({ onBack }: { onBack: () => void }) {
  const themes = useThemeStore((s) => s.themes)
  const activeId = useThemeStore((s) => s.activeId)
  const setActive = useThemeStore((s) => s.setActive)
  const isDark = useAppearance((s) => s.isDark)
  const updateTokens = useThemeStore((s) => s.updateTokens)
  const updateTokensDark = useThemeStore((s) => s.updateTokensDark)
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
  const editingIsBuiltin = editing.builtin === true

  const [selectedElement, setSelectedElement] = useState('root')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  // 明/暗令牌套编辑切换(主题仅有暗色差异时也在此编辑)
  const [editDark, setEditDark] = useState(false)
  const activeTokens = editDark ? (editing.dark ?? {}) : editing.tokens

  // 中栏预览文稿来源:sample=内置样例 / note=当前笔记 / custom=用户导入的 md
  const notes = useNotebook((s) => s.notes)
  const activeNoteId = useNotebook((s) => s.activeId)
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? notes[0] ?? null
  const [previewSource, setPreviewSource] = useState<'sample' | 'note' | 'custom'>('sample')
  const [customDoc, setCustomDoc] = useState('')
  const [cssOpen, setCssOpen] = useState(false)
  const [inspectMode, setInspectMode] = useState(false)
  const mdInputRef = useRef<HTMLInputElement>(null)
  const previewDoc =
    previewSource === 'sample' ? SAMPLE_DOC : previewSource === 'note' ? (activeNote?.content ?? '') : customDoc

  const jsonInputRef = useRef<HTMLInputElement>(null)

  const element = ELEMENTS.find((e) => e.id === selectedElement) ?? ELEMENTS[0]

  // 回落色预览:从「元素效果」迷你预览实测各颜色项未设置时的实际观感色。
  // 依赖令牌/元素/明暗编辑态,变化后重测(浏览器渲染完成后测量,保证拿到的是最新样式)
  const miniPreviewRef = useRef<HTMLDivElement | null>(null)
  const [fallbackColors, setFallbackColors] = useState<Record<string, string | undefined>>({})
  const colorKeys = useMemo(
    () => element.fields.filter((f) => f.type === 'color').map((f) => f.key),
    [element],
  )
  useEffect(() => {
    // 防抖 150ms 后再测量(双 rAF 确保样式已应用)。
    // 拖动取色器时令牌每帧变化,每帧批量 getComputedStyle 会强制同步布局,卡顿明显
    let raf2 = 0
    const timer = setTimeout(() => {
      raf2 = requestAnimationFrame(() => {
        const root = miniPreviewRef.current?.querySelector('.themd-prose')
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
      })
    }, 150)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf2)
    }
  }, [colorKeys, editing, editDark, isDark])

  // 拖动取色器的「绝对流畅」路径:令牌键 → CSS 变量名,直写两处预览容器的 style,
  // 不经过 React 渲染;松手 200ms 后 commit 走正常 store 提交(持久化+状态归位)。
  // 两个回调用 useCallback 永久稳定(内部经 implRef 间接调用最新实现),不破坏子组件 memo。
  const centerPreviewRef = useRef<HTMLDivElement | null>(null)
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
    if (editDark) {
      // 暗色套:写在 theme.dark
      const next: ThemeTokens = { ...(editing.dark ?? {}) }
      if (value === undefined) delete next[key]
      else next[key] = value
      const realId = updateTokensDark(editing.id, next)
      if (realId !== editing.id) setEditId(realId)
      return
    }
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
      const varName = TOKEN_VAR[field.key as TokenKey]
      if (!varName) return
      for (const el of [
        centerPreviewRef.current?.querySelector('.themd-prose'),
        miniPreviewRef.current?.querySelector('.themd-prose'),
      ]) {
        ;(el as HTMLElement | null)?.style.setProperty(varName, v)
      }
    }
    commitImplRef.current = (field, v) => setTokenRef.current(field.key as TokenKey, v)
  })

  const resetElement = () => {
    if (editDark) {
      const next: ThemeTokens = { ...(editing.dark ?? {}) }
      for (const k of elementTokenKeys(element.id)) delete next[k]
      updateTokensDark(editing.id, next)
      return
    }
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
    downloadFile(`${editing.name}.themd.json`, content, 'application/json')
    toast.success(`已导出「${editing.name}」主题包`)
  }

  const handleExportCss = (typora: boolean) => {
    const css = exportThemeCss(editing, typora ? '#write' : '.themd-prose')
    const suffix = typora ? '.typora' : ''
    downloadFile(`${editing.name}${suffix}.css`, css, 'text/css')
    toast.success(typora ? '已导出 Typora 兼容 CSS' : '已导出 CSS')
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
      setEditId(id)
      toast.success(
        `导入完成:映射 ${report.mapped} 条声明,附加 CSS ${report.extra} 条,跳过 ${report.skipped} 条`,
        { duration: 6000 },
      )
      return
    }
    const id = importTheme(text)
    if (id) {
      setEditId(id)
      toast.success(`已导入「${file.name.replace(/\.themd\.json$/i, '')}」`)
    } else {
      toast.error('导入失败:不是有效的主题文件')
    }
  }

  const handleCreate = () => {
    const id = crypto.randomUUID()
    upsertTheme({ version: 1, id, name: `我的主题 ${themes.length + 1}`, tokens: {} })
    setEditId(id)
    setActive(id)
  }

  return (
    <div className="flex h-full w-full flex-1 flex-col">
      {/* 顶栏 */}
      <header
        data-tauri-drag-region
        className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4"
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft /> 返回
          </Button>
          <span data-tauri-drag-region className="text-sm font-semibold">
            主题工场
          </span>
          <span className="text-xs text-muted-foreground">正在编辑：{editing.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => jsonInputRef.current?.click()}>
            <Upload /> 导入
          </Button>
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
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download /> 导出
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportJson}>
                主题包(.themd.json)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCss(false)}>
                样式表(.css)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportCss(true)}>
                Typora 主题(#write)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <WindowControls />
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        {/* 左栏：主题库 + 元素导航 */}
        <ResizablePanel defaultSize="22%" minSize="14%" maxSize="38%">
          <div className="flex h-full flex-col overflow-y-auto">
            <ThemeLibrary
              themes={listAllThemes({ themes, activeId })}
              activeId={activeId}
              editingId={editing.id}
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
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 中栏：实时预览 */}
        <ResizablePanel defaultSize="48%" minSize="25%">
          <div className="flex h-full flex-col">
            <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-3">
              <div className="flex items-center gap-1">
                {(
                  [
                    ['sample', '样例'],
                    ['note', activeNote ? `笔记:${activeNote.title.slice(0, 8)}` : '笔记(空)'],
                    ['custom', customDoc ? '我的文档' : '导入 md'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={key === 'note' && !activeNote}
                    onClick={() => {
                      if (key === 'custom' && !customDoc) {
                        mdInputRef.current?.click()
                        return
                      }
                      setPreviewSource(key)
                    }}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent',
                      previewSource === key && 'bg-accent font-medium',
                      key === 'note' && !activeNote && 'opacity-50',
                    )}
                  >
                    {key === 'custom' && !customDoc && <FileUp className="mr-1 inline size-3" />}
                    {label}
                  </button>
                ))}
                <input
                  ref={mdInputRef}
                  type="file"
                  accept=".md,.markdown,.txt"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setCustomDoc(await f.text())
                      setPreviewSource('custom')
                      toast.success(`已载入「${f.name}」`)
                    }
                    e.target.value = ''
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setInspectMode((v) => !v)}
                  className={cn(
                    'rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent',
                    inspectMode && 'bg-primary text-primary-foreground font-medium',
                  )}
                  title="点击预览中的元素,直接跳到它的设置"
                >
                  <Crosshair className="mr-1 inline size-3" />
                  选择元素
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActive(editing.id)
                    toast.success(`已应用「${editing.name}」到笔记预览`)
                  }}
                >
                  <Check /> 应用此主题
                </Button>
              </div>
            </div>
            {/* 预览直接消费「正在编辑」的主题令牌,编辑暗色套时强制按暗色编译 */}
            <StudioPreview
              theme={editing}
              content={previewDoc}
              forceDark={editDark}
              containerRef={centerPreviewRef}
              inspect={inspectMode}
              onInspect={(id) => {
                setSelectedElement(id)
                setInspectMode(false)
                toast(`已定位到「${ELEMENTS.find((e) => e.id === id)?.label ?? id}」`)
              }}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右栏：属性面板 + 元素效果小预览 */}
        <ResizablePanel defaultSize="30%" minSize="20%" maxSize="45%">
          <div className="flex h-full flex-col overflow-y-auto">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{element.label}</h2>
              <div className="flex items-center gap-1">
                {/* 明/暗令牌套切换 */}
                <div className="flex overflow-hidden rounded-md border text-xs">
                  <button
                    type="button"
                    className={cn('px-2 py-1', !editDark && 'bg-accent font-medium')}
                    onClick={() => setEditDark(false)}
                  >
                    亮
                  </button>
                  <button
                    type="button"
                    className={cn('px-2 py-1', editDark && 'bg-accent font-medium')}
                    onClick={() => setEditDark(true)}
                  >
                    暗
                  </button>
                </div>
                <Button variant="ghost" size="sm" onClick={resetElement}>
                  <RotateCcw /> 恢复默认
                </Button>
              </div>
            </div>
            {editDark && (
              <p className="border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
                正在编辑暗色令牌套:仅在应用切换到暗色模式时生效,适合为同一主题定义明暗两副面孔。
              </p>
            )}
            {editingIsBuiltin && (
              <p className="border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
                内置主题为只读展示，改动任意一项时会自动创建「{editing.name} 副本」并继续编辑。
              </p>
            )}
            {/* 元素效果：当前元素的专属参照物，与控件直接对照；也是回落色的测量源 */}
            <div className="border-b px-4 py-3">
              <p className="pb-1.5 text-xs font-medium text-muted-foreground">元素效果</p>
              <div className="rounded-lg border bg-background p-3">
                <div ref={miniPreviewRef} data-mini-preview={element.id}>
                  <ThemeScopedPreview
                    theme={editing}
                    content={ELEMENT_SAMPLES[element.id] ?? element.label}
                    compact
                  />
                </div>
              </div>
            </div>
            <div className="px-4 py-2">
              {element.fields.map((f) =>
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
                    onChange={(v) => setTokenStable(f.key, v)}
                  />
                ),
              )}
              {element.fields.some((f) => f.hint) && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  {element.fields
                    .filter((f) => f.hint)
                    .map((f) => (
                      <p key={f.key} className="text-xs text-muted-foreground">
                        {f.label}：{f.hint}
                      </p>
                    ))}
                </div>
              )}
            </div>

            {/* 附加自定义 CSS（高级模式，P4） */}
            <div className="mt-auto border-t">
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
                {cssOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
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
  )
}

/** 工场中栏预览：与 PreviewPane 同构，但消费指定的主题而非全局激活主题 */
function StudioPreview({
  theme,
  content,
  forceDark = false,
  inspect = false,
  onInspect,
  containerRef,
}: {
  theme: ThemeFile
  content: string
  forceDark?: boolean
  inspect?: boolean
  onInspect?: (elementId: string) => void
  /** 外部直写 CSS 变量的挂载点(取色器拖动实时预览用) */
  containerRef?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="min-h-0 flex-1" ref={containerRef}>
      <ThemeScopedPreview
        theme={theme}
        content={content}
        forceDark={forceDark}
        inspect={inspect}
        onInspect={onInspect}
      />
    </div>
  )
}

const ThemeScopedPreview = memo(function ThemeScopedPreview({
  theme,
  content,
  compact = false,
  forceDark = false,
  inspect = false,
  onInspect,
}: {
  theme: ThemeFile
  content: string
  /** 迷你模式：右栏「元素效果」卡片用，去掉限宽与大留白 */
  compact?: boolean
  /** 工场编辑暗色令牌套时强制按暗色编译 */
  forceDark?: boolean
  /** inspect 模式:点击元素回调(配合中栏的「选择元素」开关) */
  inspect?: boolean
  onInspect?: (elementId: string) => void
}) {
  const html = useMemo(() => renderMarkdown(content).html, [content])
  const isDark = useAppearance((s) => s.isDark)
  const cssVars = useMemo(
    () => compileTokens(theme.tokens, theme.dark, forceDark || isDark),
    [theme, forceDark, isDark],
  )
  useExtraCss(theme.id, theme.extraCss)

  // 图片灯箱:仅完整预览开启;inspect(选择元素)模式下点击仍走元素拾取。
  // 一次收集预览全部图片,可在灯箱里左右切换
  const [lightbox, setLightbox] = useState<{ slides: LightboxSlide[]; index: number } | null>(null)
  const lightboxEnabled = !compact && !inspect
  const handleImageClick = (e: React.MouseEvent) => {
    const state = collectLightboxState(e.currentTarget, e.target)
    if (!state) return
    e.preventDefault()
    setLightbox(state)
  }

  const handleClick = inspect
    ? (e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('.themd-prose')) return
        onInspect?.(inspectElementId(target))
      }
    : lightboxEnabled
      ? handleImageClick
      : undefined

  return (
    <div
      className={cn(
        compact ? 'max-h-52 overflow-y-auto' : 'h-full overflow-y-auto',
        inspect && 'cursor-crosshair [&_*:hover]:outline [&_*:hover]:outline-1 [&_*:hover]:outline-primary/50',
      )}
      onClick={handleClick}
    >
      <article
        className={cn('themd-prose', compact ? 'px-0 py-1 text-sm' : 'mx-auto px-6 py-8')}
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
    </div>
  )
})

/** 左栏上部：主题库 */
function ThemeLibrary(props: {
  themes: ThemeFile[]
  activeId: string
  editingId: string
  onSelectPreview: (id: string) => void
  onSelectEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onCreate: () => void
}) {
  const { themes, activeId, editingId } = props
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  return (
    <div className="border-b p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-medium text-muted-foreground">主题库</span>
        <Button variant="ghost" size="xs" onClick={props.onCreate}>
          <FilePlus2 /> 新建
        </Button>
      </div>
      <div className="space-y-0.5">
        {themes.map((t) => (
          <div
            key={t.id}
            className={cn(
              'group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent',
              editingId === t.id && 'bg-accent',
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left"
              onClick={() => props.onSelectEdit(t.id)}
              title="编辑此主题"
            >
              {t.name}
              {t.builtin && <span className="ml-1.5 text-xs text-muted-foreground">内置</span>}
              {activeId === t.id && (
                <span className="ml-1.5 text-xs text-primary">● 使用中</span>
              )}
            </button>
            {activeId !== t.id && (
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0"
                onClick={() => props.onSelectPreview(t.id)}
              >
                使用
              </Button>
            )}
            <ThemeItemMenu
              canDelete={!t.builtin}
              duplicating={false}
              onDuplicate={() => props.onDuplicate(t.id)}
              onRename={() => {
                setRenamingId(t.id)
                setRenameValue(t.name)
              }}
              onDelete={() => props.onDelete(t.id)}
            />
          </div>
        ))}
      </div>
      {renamingId && (
        <div className="mt-1 flex items-center gap-1 px-1">
          <Input
            value={renameValue}
            autoFocus
            className="h-7 text-xs"
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameValue.trim()) {
                props.onRename(renamingId, renameValue.trim())
                setRenamingId(null)
              }
              if (e.key === 'Escape') setRenamingId(null)
            }}
          />
          <Button
            size="sm"
            onClick={() => {
              if (renameValue.trim()) props.onRename(renamingId, renameValue.trim())
              setRenamingId(null)
            }}
          >
            <Check />
          </Button>
        </div>
      )}
    </div>
  )
}

function ThemeItemMenu(props: {
  canDelete: boolean
  duplicating: boolean
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 shrink-0 opacity-0 group-hover:opacity-100" aria-label="主题操作">
          <Pencil className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={props.onRename}>
          <Pencil /> 重命名
        </DropdownMenuItem>
        <DropdownMenuItem onClick={props.onDuplicate}>
          <Copy /> 创建副本
        </DropdownMenuItem>
        {props.canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={props.onDelete}>
              <Trash2 /> 删除
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
              {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
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
                      'block w-full rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-accent',
                      selected === e.id && 'bg-accent font-medium',
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
