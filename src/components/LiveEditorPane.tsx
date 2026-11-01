import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { TextSelection } from '@tiptap/pm/state'
import { FolderOpen } from 'lucide-react'
import {
  Bold,
  Check,
  ClipboardPaste,
  Code,
  Copy,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Scissors,
  TextQuote,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { compileTokens } from '@/lib/theme/compile'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'
import { useExtraCss } from '@/components/theme/useExtraCss'
import { assetsPathToAbsolute } from '@/lib/image-src'
import { appEvents } from '@/shared/events/app-events'
import { platformServices } from '@/app/platform'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { LiveEditorController } from '@/modules/live-editor/application/live-editor-controller'
import {
  copyAsHtml,
  copyAsMarkdown,
  copySelection,
  copySimplified,
  currentHeadingLevel,
  cutSelection,
  deleteSelection,
  insertCodeBlock,
  insertHorizontalRule,
  insertLink,
  insertMarkdown,
  insertMathBlock,
  insertParagraphAbove,
  insertParagraphBelow,
  insertTable,
  pasteAsPlainText,
  pasteClipboard,
  selectionEmpty,
  setHeading,
  toggleBold,
  toggleBulletList,
  toggleInlineCode,
  toggleItalic,
  toggleOrderedList,
  toggleQuote,
  toggleTaskList,
} from '@/modules/live-editor/application/live-commands'
import { imageFilesToMarkdown } from '@/modules/live-editor/application/live-image-insert'
import { liveEditorExtensions } from '@/modules/live-editor/application/live-shortcuts'

/** 菜单里的图标按钮(Typora 式网格,与 EditorPane 同款) */
function MenuIconBtn({
  icon: Icon,
  title,
  disabled,
  onSelect,
}: {
  icon: LucideIcon
  title: string
  disabled?: boolean
  onSelect: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      title={title}
      aria-label={title}
      className="h-8 w-full text-foreground/80"
      onClick={(e) => {
        e.preventDefault()
        onSelect()
      }}
    >
      <Icon />
    </Button>
  )
}

/** 用系统方式打开图片:优先文件管理器定位,失败回落默认程序 */
function openAsset(absolute: string): void {
  platformServices.files.revealItemInDir(absolute).catch(() =>
    platformServices.files.openPath(absolute).catch(() => toast.error('打开图片失败')),
  )
}

/**
 * 实时预览编辑器(TipTap/ProseMirror,渲染态直接编辑——Typora 式)。
 *
 * - 排版:容器注入主题令牌(--t-*),编辑器元素挂 .themd-prose——与预览/
 *   导出同一套 theme-base.css 排版,编辑即所见
 * - 同步:LiveEditorController 持块级 sourceMap,编辑 → 未动块逐字节原文、
 *   dirty 块序列化,onChange 交给既有防抖写回管线(与 CM 同一条路)
 * - 命令层:右键菜单/快捷键对齐 CM 版(脚注/引用链接/TOC/YAML 头依赖
 *   P4 自定义节点,暂不提供)
 * - 图片:三模式插入管线复用,粘贴/拖放接管;Ctrl+点击定位文件、悬停浮出
 *   「打开图片位置」(assets 可解析时)
 */
export const LiveEditorPane = memo(function LiveEditorPane({
  value,
  onChange,
  noteThemeId,
  noteDir = null,
}: {
  value: string
  onChange: (value: string) => void
  /** 本篇笔记的主题覆盖;未设置跟随全局 */
  noteThemeId?: string
  /** 活动笔记(绑定磁盘文件时)的所在目录;插图落盘基准 */
  noteDir?: string | null
}) {
  // controller 与组件同生命周期(key 重挂载 = 换笔记重建,undo 历史随之清零,
  // 与 CM 的 remount 语义一致)
  const controller = useMemo(() => new LiveEditorController(value), []) // eslint-disable-line react-hooks/exhaustive-deps -- 仅挂载期初值,后续外部改动走 rebind
  const lastEmittedRef = useRef(value)
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  /** 图片插入统一入口:文件 → markdown 字符串 → 解析插入(渲染态直接成图) */
  const insertImages = async (files: File[]) => {
    const mds = await imageFilesToMarkdown(files, noteDir)
    if (mds?.length && editorRef.current) insertMarkdown(editorRef.current, mds.join('\n\n'))
  }

  const editor = useEditor({
    extensions: liveEditorExtensions(),
    content: controller.buildDocJson(),
    // .themd-prose:theme-base.css 的整套排版(标题/引用/表格/代码)直接生效
    editorProps: {
      attributes: { class: 'themd-prose live-prose', spellcheck: 'false' },
      // 粘贴图片文件 → 三模式管线接管(非纯图片组不拦,走默认粘贴)
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])]
        if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return false
        event.preventDefault()
        void insertImages(files)
        return true
      },
      // 拖放图片:落点即插入位
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const files = [...(event.dataTransfer?.files ?? [])]
        if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (pos) {
          view.dispatch(
            view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos.pos))),
          )
        }
        void insertImages(files)
        return true
      },
      // Ctrl+点击图片 = 文件管理器定位(与 CM 版同款交互)
      handleClick: (view, pos, event) => {
        if (!(event as MouseEvent).ctrlKey && !(event as MouseEvent).metaKey) return false
        const target = event.target as HTMLElement | null
        if (!(target instanceof HTMLImageElement)) return false
        const node = view.state.doc.nodeAt(pos)
        const raw = node?.type.name === 'image' ? (node.attrs.src as string | null) : null
        if (!raw) return false
        const absolute = assetsPathToAbsolute(raw)
        if (absolute) {
          event.preventDefault()
          openAsset(absolute)
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      const next = controller.onUpdate(editor.state.doc)
      if (next !== null) {
        lastEmittedRef.current = next
        onChange(next)
      }
    },
  })

  // 编辑器就绪:种子化归属表 + 暴露给事件期回调(粘贴/插图/悬停定位)
  useEffect(() => {
    editorRef.current = editor
    if (editor) controller.seed(editor.state.doc)
  }, [editor, controller])

  // 外部改动(value ≠ 自己刚发出的):整体重绑,等价 CM 的外部重载
  useEffect(() => {
    if (!editor || value === lastEmittedRef.current) return
    lastEmittedRef.current = value
    editor.commands.setContent(controller.rebind(value), { emitUpdate: false })
    controller.seed(editor.state.doc)
  }, [value, editor, controller])

  // 菜单/App 触发插图(Ctrl+Shift+I / 右键菜单「图像」)
  useEffect(() => {
    const off = appEvents.on('insertImage', () => fileInputRef.current?.click())
    return off
  }, [])
  const handlePick = async (e: { target: EventTarget | null }) => {
    const input = e.target as HTMLInputElement
    const files = [...(input.files ?? [])]
    input.value = ''
    if (files.length) await insertImages(files)
  }

  // ── 悬停图片 → 「打开图片位置」浮层(assets 可解析时) ──────────────────
  const [assetHover, setAssetHover] = useState<
    { x: number; top: number; path: string; keep: { l: number; r: number; t: number; b: number } } | null
  >(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** 图片 DOM → markdown 原始 src(attrs 未解析,与序列化同源) */
  const rawSrcOf = (img: HTMLImageElement): string | null => {
    const ed = editorRef.current
    if (!ed) return null
    const pos = ed.view.posAtDOM(img, 0)
    const node = ed.state.doc.nodeAt(pos)
    return node?.type.name === 'image' ? ((node.attrs.src as string | null) ?? null) : null
  }
  const hideHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setAssetHover(null)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    // 等待区内保持现状(按钮不是容器子元素,移动途中防误隐藏)
    if (assetHover && x >= assetHover.keep.l && x <= assetHover.keep.r && y >= assetHover.keep.t && y <= assetHover.keep.b) {
      return
    }
    const target = e.target as HTMLElement
    const img = target.closest('img')
    const raw = img instanceof HTMLImageElement ? rawSrcOf(img) : null
    const absolute = raw ? assetsPathToAbsolute(raw) : null
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (!img || !raw || !absolute) {
      hideHover()
      return
    }
    const rect = img.getBoundingClientRect()
    hoverTimer.current = setTimeout(() => {
      const below = rect.top < 48 // 贴近视口顶部翻到图下方
      const top = below ? rect.bottom + 6 : rect.top - 34
      setAssetHover({
        x: rect.left + rect.width / 2,
        top,
        path: raw,
        keep: { l: rect.left + rect.width / 2 - 90, r: rect.left + rect.width / 2 + 90, t: Math.min(top, rect.top) - 8, b: Math.max(top + 28, rect.bottom) + 8 },
      })
    }, 300)
  }

  // ── 主题令牌(与 PreviewPane 同链路:笔记覆盖 > 全局) ──────────────────
  const activeId = useThemeStore((s) => s.activeId)
  const themes = useThemeStore((s) => s.themes)
  const theme = useMemo(() => {
    if (noteThemeId) {
      const overridden = listAllThemes({ themes, activeId }).find((t) => t.id === noteThemeId)
      if (overridden) return overridden
    }
    return resolveActiveTheme({ themes, activeId })
  }, [themes, activeId, noteThemeId])
  const isDark = useAppearance((s) => s.isDark)
  const cssVars = useMemo(() => compileTokens(theme.tokens, theme.dark, isDark), [theme, isDark])
  useExtraCss(theme.id, theme.extraCss)

  // ── 右键菜单状态:打开瞬间取选择区快照(与 EditorPane 的 menuTick 同法) ──
  const [menuTick, setMenuTick] = useState(0)
  const ed = editor
  const selEmpty = menuTick >= 0 && (!ed || selectionEmpty(ed))
  const headingLevel = menuTick >= 0 && ed ? currentHeadingLevel(ed) : 0
  const runEditor = (fn: (target: NonNullable<typeof ed>) => void) => {
    if (ed) fn(ed)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={containerRef}
          className="h-full overflow-y-auto"
          style={cssVars}
          onContextMenu={() => setMenuTick((t) => t + 1)}
          onMouseMove={onMouseMove}
          onMouseLeave={hideHover}
        >
          <EditorContent editor={editor} className="live-editor-shell" />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-56">
        {/* 剪贴板图标网格(Typora 同款) */}
        <div className="grid grid-cols-4 gap-1 px-1.5 pt-2">
          <MenuIconBtn
            icon={Scissors}
            title="剪切"
            disabled={selEmpty}
            onSelect={() => runEditor((t) => void cutSelection(t))}
          />
          <MenuIconBtn
            icon={Copy}
            title="复制"
            disabled={selEmpty}
            onSelect={() => runEditor((t) => void copySelection(t))}
          />
          <MenuIconBtn
            icon={ClipboardPaste}
            title="粘贴"
            onSelect={() => runEditor((t) => void pasteClipboard(t))}
          />
          <MenuIconBtn
            icon={Trash2}
            title="删除"
            disabled={selEmpty}
            onSelect={() => runEditor(deleteSelection)}
          />
        </div>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">复制 / 粘贴为…</ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-56">
            <ContextMenuItem
              disabled={selEmpty}
              onSelect={() => runEditor((t) => void copyAsMarkdown(t))}
            >
              复制为 Markdown
            </ContextMenuItem>
            <ContextMenuItem disabled={selEmpty} onSelect={() => runEditor((t) => void copyAsHtml(t))}>
              复制为 HTML 代码
            </ContextMenuItem>
            <ContextMenuItem disabled={selEmpty} onSelect={() => runEditor((t) => void copySimplified(t))}>
              复制内容并简化格式
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => runEditor((t) => void pasteAsPlainText(t))}>
              粘贴为纯文本
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        {/* 格式图标网格:行内 + 块级 */}
        <div className="grid grid-cols-4 gap-1 px-1.5 py-1.5">
          <MenuIconBtn icon={Bold} title="加粗" onSelect={() => runEditor(toggleBold)} />
          <MenuIconBtn icon={Italic} title="斜体" onSelect={() => runEditor(toggleItalic)} />
          <MenuIconBtn icon={Code} title="行内代码" onSelect={() => runEditor(toggleInlineCode)} />
          <MenuIconBtn icon={Link2} title="链接" onSelect={() => runEditor(insertLink)} />
          <MenuIconBtn icon={TextQuote} title="引用" onSelect={() => runEditor(toggleQuote)} />
          <MenuIconBtn icon={ListOrdered} title="有序列表" onSelect={() => runEditor(toggleOrderedList)} />
          <MenuIconBtn icon={List} title="无序列表" onSelect={() => runEditor(toggleBulletList)} />
          <MenuIconBtn icon={ListTodo} title="任务列表" onSelect={() => runEditor(toggleTaskList)} />
        </div>
        {/* 段落:标题层级,当前层级打勾 */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">段落</ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-44">
            {([1, 2, 3, 4, 5, 6] as const).map((level) => (
              <ContextMenuItem key={level} onSelect={() => runEditor((t) => setHeading(t, level))}>
                {headingLevel === level && <Check className="size-3.5" />}
                {level} 级标题
                <ContextMenuShortcut>Ctrl+{level}</ContextMenuShortcut>
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => runEditor((t) => setHeading(t, 0))}>
              {headingLevel === 0 && <Check className="size-3.5" />}
              段落
              <ContextMenuShortcut>Ctrl+0</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        {/* 插入:脚注/链接引用/TOC/YAML 依赖 P4 自定义节点,暂缺 */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">插入</ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-44">
            <ContextMenuItem onSelect={() => appEvents.emit('insertImage')}>
              图像
              <ContextMenuShortcut>Ctrl+Shift+I</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => runEditor(insertHorizontalRule)}>水平分割线</ContextMenuItem>
            <ContextMenuItem onSelect={() => runEditor(insertTable)}>
              表格
              <ContextMenuShortcut>Ctrl+T</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => runEditor(insertCodeBlock)}>
              代码块
              <ContextMenuShortcut>Ctrl+Shift+K</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => runEditor(insertMathBlock)}>
              公式块
              <ContextMenuShortcut>Ctrl+Shift+M</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => runEditor(insertParagraphAbove)}>段落（上方）</ContextMenuItem>
            <ContextMenuItem onSelect={() => runEditor(insertParagraphBelow)}>段落（下方）</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePick}
      />
      {assetHover &&
        createPortal(
          <Button
            variant="outline"
            size="sm"
            className="fixed z-[60] shadow-md"
            style={{ left: assetHover.x, top: assetHover.top, transform: 'translateX(-50%)' }}
            onMouseDown={(e) => {
              e.preventDefault()
              const absolute = assetsPathToAbsolute(assetHover.path)
              hideHover()
              if (absolute) openAsset(absolute)
            }}
            onMouseLeave={hideHover}
          >
            <FolderOpen />
            打开图片位置
          </Button>,
          document.body,
        )}
    </ContextMenu>
  )
})
