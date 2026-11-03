import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { foldGutter } from '@codemirror/language'
import { search } from '@codemirror/search'
import { Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers as cmLineNumbers } from '@codemirror/view'
import {
  defaultSettingsGithubDark,
  defaultSettingsGithubLight,
  githubDarkInit,
  githubLightInit,
} from '@uiw/codemirror-theme-github'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  type LucideIcon,
  Bold,
  Check,
  ClipboardPaste,
  Code,
  Copy,
  FolderOpen,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Scissors,
  TextQuote,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

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
import { imagePlaceholder } from '@/lib/image-decorator'
import {
  copySelection,
  currentHeadingLevel,
  cutSelection,
  deleteSelection,
  insertCodeBlock,
  insertFootnote,
  insertHorizontalRule,
  insertLink,
  insertMathBlock,
  insertParagraphAbove,
  insertParagraphBelow,
  insertRefLink,
  insertTable,
  insertToc,
  insertYamlFrontMatter,
  pasteClipboard,
  setHeading,
  simplifyMarkdown,
  toggleInline,
  toggleLinePrefix,
} from '@/lib/markdown-commands'
import { renderStaticHtml } from '@/modules/rendering/static-html'
import { fileToAssetImage, fileToEmbeddedImage, fileToUploadedImage, insertImageMarkdown } from '@/lib/image'
import { assetsPathToAbsolute } from '@/lib/image-src'
import { platformServices } from '@/app/platform'
import { useAppearance } from '@/store-appearance'
import { appEvents } from '@/shared/events/app-events'
import { DEFAULT_EDITOR_STACK, buildFontStack, useEditorPrefs } from '@/store-editor'

/** 菜单里的图标按钮(Typora 式网格)。
 * 必须是 ContextMenuItem(asChild)而非普通 Button:Radix 只在「菜单项」被
 * 选中时关菜单,裸按钮点了菜单不消失。 */
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
    <ContextMenuItem asChild disabled={disabled} onSelect={() => onSelect()}>
      <Button
        variant="ghost"
        size="icon"
        title={title}
        aria-label={title}
        className="h-8 w-full px-0 text-foreground/80"
      >
        <Icon />
      </Button>
    </ContextMenuItem>
  )
}

/** 批量处理图片文件并插入;全部为图片才接管事件,返回是否接管 */
async function insertImageFiles(
  view: EditorView,
  files: File[],
  pos: number,
  noteDir: string | null,
): Promise<boolean> {
  if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return false
  const alt = (name: string) => name.replace(/\.[^.]+$/, '') || '图片'
  toast.info(files.length > 1 ? `正在插入 ${files.length} 张图片…` : '正在插入图片…')
  // 本地 assets 模式:图片落盘 `${root}/assets/`,正文引用相对路径;
  // 绑定磁盘文件的笔记落笔记自身目录(与相对路径解析基准一致,随文件走),
  // 库内笔记 assetsRoot 未自定义时用平台默认(应用数据目录)。remote 模式:
  // 上传图床拿外链(失败抛错即中止该张,不回落)
  const {
    imageMode, assetsRoot,
    uploaderProvider, githubRepo, githubToken, picgoUrl,
  } = useEditorPrefs.getState()
  const useAssets = imageMode === 'assets'
  const useRemote = imageMode === 'remote'
  const uploaderConfig = { provider: uploaderProvider, githubRepo, githubToken, picgoUrl }
  const root = useAssets && noteDir
    ? `${noteDir.replace(/[\\/]+$/, '')}\\assets`
    : useAssets && assetsRoot.trim()
      ? assetsRoot.trim()
      : await platformServices.files.defaultAssetsRoot()
  let at = pos
  let ok = 0
  for (const file of files) {
    try {
      const insertValue = useAssets
        ? (await fileToAssetImage(file, root, platformServices.files.writeBinaryFile)).relativePath
        : useRemote
          ? await fileToUploadedImage(file, (bytes, name) => platformServices.uploader.upload(uploaderConfig, bytes, name))
          : await fileToEmbeddedImage(file)
      insertImageMarkdown(view, at, insertValue, alt(file.name))
      // 上一张插入后光标停在其行尾(空行上),从这里续插下一张
      at = view.state.selection.main.head
      ok++
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `「${file.name}」处理失败`)
    }
  }
  if (ok) toast.success(`已插入 ${ok} 张图片`)
  return true
}

/** 光标文档位置命中的 assets/ 图片链接;未命中返回 null */
function assetLinkAt(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos)
  const match = /\]\((assets\/[^\s)]+\.[\w]+)\)/.exec(line.text)
  if (!match) return null
  const from = line.from + match.index + 2
  if (pos < from || pos > line.from + match.index + match[0].length) return null
  return match[1]
}

/** 用系统方式打开图片:优先文件管理器定位,失败回落默认程序 */
function openAsset(absolute: string): void {
  platformServices.files.revealItemInDir(absolute).catch(() =>
    platformServices.files.openPath(absolute).catch(() => toast.error('打开图片失败')),
  )
}

/**
 * hover assets/ 图片行 → 延时后浮出「打开图片位置」按钮(shadcn Button,
 * portal 渲染,紧贴编辑器顶部时自动翻到行下方);移出图片行立即隐藏。
 * 按钮必然压住相邻行的下半段,鼠标路过相邻行会不断触发重锚,按钮被
 * “追着跑”点不到;移到按钮上时编辑器也会收到 mouseleave(按钮不是编辑器
 * 子元素)而误判离开。因此显示按钮时记录一块「等待区」(按钮本体±余量),
 * 鼠标在区内时 move/leave 一律保持现状,按钮原地等鼠标进来,必然点得中。
 */

/** 浮层按钮与行的间距、按钮高度(h-7 = 28px),用于上/下摆放的命中计算 */
const HOVER_BTN_GAP = 6
const HOVER_BTN_HEIGHT = 28
/** 悬停图片行多久才浮出按钮;移出是立即隐藏,不给延时 */
const HOVER_SHOW_DELAY = 300

/** 等待区:半宽按按钮实际宽(约 115px)外留足余量,向行内/外侧各延伸 4px */
const HOVER_KEEP_HALF_W = 90
const HOVER_KEEP_PAD = 4

/** 浮层显示目标:x/top 为按钮 fixed 定位(视口坐标,水平居中锚点);
 * below = 是否翻到行下方;lineEdgeY = 所贴行的边缘(上放=行顶,下放=行底) */
type AssetHoverTarget = { x: number; top: number; path: string; below: boolean; lineEdgeY: number }

/** 定时器与待显示位置放模块级:闭包进 CodeMirror 扩展的 useMemo 不碰 React ref */
let assetHoverShowTimer: ReturnType<typeof setTimeout> | undefined
/** 倒计时期间的最新悬停位置,到点显示在这里(而不是 300ms 前的位置) */
let assetHoverPending: AssetHoverTarget | null = null
/** 当前浮层按钮的等待区(视口坐标);按钮隐藏时置 null */
let assetHoverKeep: { left: number; top: number; right: number; bottom: number } | null = null

function inAssetHoverKeep(x: number, y: number): boolean {
  const keep = assetHoverKeep
  return !!keep && x >= keep.left && x <= keep.right && y >= keep.top && y <= keep.bottom
}

/**
 * CodeMirror 编辑器封装。
 * 语法配色用 GitHub Light/Dark 跟随明暗开关,与内置 GitHub 渲染主题呼应;
 * 背景/行号槽/活动行设为透明或语义令牌色,编辑区观感与整体 UI 联动。
 * 英文字体默认使用随应用打包的 JetBrains Mono;设置抽屉自定义后按设置走。
 */
export function EditorPane({
  value,
  onChange,
  bindScroller,
  noteDir,
}: {
  value: string
  onChange: (value: string) => void
  /** 绑定内部滚动容器(.cm-scroller),用于编辑/预览同步滚动 */
  bindScroller?: (el: HTMLElement | null) => void
  /** 活动笔记(绑定磁盘文件时)的所在目录;插图落盘基准 */
  noteDir?: string | null
}) {
  const isDark = useAppearance((s) => s.isDark)
  // CodeMirror view 引用:粘贴/拖拽/菜单插图都要在精确光标处 dispatch
  const viewRef = useRef<EditorView | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // hover 浮层按钮,完整显示目标见 AssetHoverTarget
  const [assetHover, setAssetHover] = useState<AssetHoverTarget | null>(null)
  // 显示/重锚浮层,同时刷新等待区供 move/leave 判定“保持现状”。等待区从
  // 按钮边缘向所贴行内延伸 4px:否则行顶与按钮之间留缝,移向按钮途中
  // 落缝的那一刻既不在行内也不在区内,会按“移出”立即隐藏
  const showAssetHover = useCallback((target: AssetHoverTarget) => {
    if (assetHoverShowTimer) {
      clearTimeout(assetHoverShowTimer)
      assetHoverShowTimer = undefined
    }
    assetHoverPending = null
    assetHoverKeep = target.below
      ? {
          left: target.x - HOVER_KEEP_HALF_W,
          right: target.x + HOVER_KEEP_HALF_W,
          top: target.lineEdgeY - HOVER_KEEP_PAD,
          bottom: target.top + HOVER_BTN_HEIGHT + HOVER_KEEP_PAD,
        }
      : {
          left: target.x - HOVER_KEEP_HALF_W,
          right: target.x + HOVER_KEEP_HALF_W,
          top: target.top - HOVER_KEEP_PAD,
          bottom: target.lineEdgeY + HOVER_KEEP_PAD,
        }
    setAssetHover(target)
  }, [])
  // 记录待显示位置(实时跟随鼠标);倒计时到点显示在最新位置
  const stageAssetHover = useCallback((target: AssetHoverTarget) => {
    assetHoverPending = target
  }, [])
  // 首次悬停进入倒计时;已在倒计时不重复起表
  const scheduleAssetHoverShow = useCallback(() => {
    if (assetHoverShowTimer) return
    assetHoverShowTimer = setTimeout(() => {
      assetHoverShowTimer = undefined
      const pending = assetHoverPending
      if (pending) showAssetHover(pending)
    }, HOVER_SHOW_DELAY)
  }, [showAssetHover])
  // 立即隐藏:同时取消待显示倒计时与等待区,不留延时
  const hideAssetHoverNow = useCallback(() => {
    if (assetHoverShowTimer) {
      clearTimeout(assetHoverShowTimer)
      assetHoverShowTimer = undefined
    }
    assetHoverPending = null
    assetHoverKeep = null
    setAssetHover(null)
  }, [])
  // 编辑器默认使用打包字体;设置里自定义后 store 注入 --font-editor。无论哪种,都要用样式模块覆盖
  // .cm-scroller——CodeMirror 基础主题在那里硬编码了 monospace
  const editorFont = useEditorPrefs((s) =>
    s.editorFontWestern || s.editorFontCjk
      ? buildFontStack(s.editorFontWestern, s.editorFontCjk, 'monospace')
      : DEFAULT_EDITOR_STACK,
  )

  const fontExt = useMemo(
    () =>
      EditorView.theme({
        '&': { fontFamily: editorFont },
        '.cm-scroller': { fontFamily: editorFont },
        // 行号必须等宽对齐,统一使用编辑器字体链。tabular-nums 兜底数字宽度
        '.cm-lineNumbers .cm-gutterElement': {
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
        },
      }),
    [editorFont],
  )

  // GitHub 语法配色;背景/活动行透明化,行号槽给淡色实体背景(用户感知为
  // 「行号区应有底色」)。settings 值直接写 CSS 表达式,var() 合法。
  // 注意:这里的样式模块在 style 表中晚于下方 chromeExt,同特异性下后者写的
  // gutter 属性会被这里覆盖——gutter 背景只在此处声明,避免双写打架。
  const themeExt = useMemo(
    () =>
      isDark
        ? githubDarkInit({
            settings: {
              ...defaultSettingsGithubDark,
              background: 'transparent',
              gutterBackground: 'var(--muted)',
              gutterBorder: 'color-mix(in oklch, var(--border) 60%, transparent)',
              lineHighlight: 'transparent',
            },
          })
        : githubLightInit({
            settings: {
              ...defaultSettingsGithubLight,
              background: 'transparent',
              gutterBackground: 'var(--muted)',
              gutterBorder: 'color-mix(in oklch, var(--border) 60%, transparent)',
              lineHighlight: 'transparent',
            },
          }),
    [isDark],
  )

  // 活动行/光标走 shadcn 语义令牌(行号槽背景/边线已由 themeExt settings 接管)
  const chromeExt = useMemo(
    () =>
      EditorView.theme({
        '.cm-activeLineGutter': {
          backgroundColor: 'color-mix(in oklch, var(--accent) 55%, transparent)',
          color: 'var(--foreground)',
        },
        '.cm-activeLine': {
          backgroundColor: 'color-mix(in oklch, var(--accent) 30%, transparent)',
        },
        '.cm-caret': { color: 'var(--primary)' },
        // 行号区几何:以「图形到 gutter 色带左右边缘的距离」对称,各 10px。
        // 箭头槽 22px(左 10px 空白 + 箭头 12px 贴右紧邻行号);行号数字
        // text-align:right + 右 padding 10px——数字永远精确落在右 10px 处,
        // 一位数/多位数都稳(text-align:center 的居中余量会随位数变化,不可靠)
        '.cm-lineNumbers .cm-gutterElement': {
          textAlign: 'right',
          padding: '0 10px 0 0',
        },
        '.cm-foldGutter .cm-gutterElement': {
          width: '22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 0 0 10px',
        },
        // 关闭折叠开关后折叠槽消失,行号槽回到居中 + 左右各 10px
        '.cm-gutters:not(:has(.cm-foldGutter)) .cm-lineNumbers .cm-gutterElement': {
          textAlign: 'center',
          padding: '0 10px',
        },
      }),
    [],
  )

  // 图片插入:粘贴截图 / 拖拽文件 / 菜单选择(经 appEvents)三入口
  const imageExt = useMemo(
    () =>
      EditorView.domEventHandlers({
        paste: (event, view) => {
          const files = [...(event.clipboardData?.files ?? [])]
          if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return false
          event.preventDefault()
          void insertImageFiles(view, files, view.state.selection.main.head, noteDir ?? null)
          return true
        },
        drop: (event, view) => {
          const files = [...(event.dataTransfer?.files ?? [])]
          if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return false
          event.preventDefault()
          const pos =
            view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
            view.state.selection.main.head
          void insertImageFiles(view, files, pos, noteDir ?? null)
          return true
        },
        dragover: (event) => {
          // 不阻止默认行为,浏览器会直接打开拖入的图片文件
          if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
          return false
        },
        mousemove: (event, view) => {
          // 鼠标在浮层等待区内:保持现状。既不重锚(否则相邻图片行会让按钮
          // 越推越远,追不到)也不调度隐藏(否则移向按钮途中就被收掉)
          if (inAssetHoverKeep(event.clientX, event.clientY)) return false
          // hover assets/ 图片行 → 鼠标上方浮出「打开图片位置」按钮。
          // lineBlockAtHeight 收文档坐标,block.top 也是文档坐标:
          // 一律以 view.documentTop(首行顶部在屏幕上的 y)换算,
          // 不能拿 view.dom.top ± scrollTop 凑——差了内容 padding,
          // 且误差随滚动量放大,按钮会飘离所在行跟着鼠标乱跳。
          const docTop = view.documentTop
          const block = view.lineBlockAtHeight(event.clientY - docTop)
          const lineTop = docTop + block.top
          const bounds = view.scrollDOM.getBoundingClientRect()
          const inside =
            event.clientY >= lineTop &&
            event.clientY <= lineTop + block.height &&
            event.clientX >= bounds.left &&
            event.clientX <= bounds.right
          if (inside) {
            const line = view.state.doc.lineAt(block.from)
            const match = /\]\((assets\/[^\s)]+\.[\w]+)\)/.exec(line.text)
            if (match) {
              // 默认悬在鼠标上方;所在行贴近编辑器可视顶部时翻到行下,
              // 避免浮层顶出可视区。水平以鼠标为中心,收进视口防截断
              const aboveTop = lineTop - HOVER_BTN_HEIGHT - HOVER_BTN_GAP
              const below = aboveTop < bounds.top + 2
              const x = Math.min(Math.max(event.clientX, 80), window.innerWidth - 80)
              const target: AssetHoverTarget = {
                x,
                top: below ? lineTop + block.height + HOVER_BTN_GAP : aboveTop,
                path: match[1],
                below,
                lineEdgeY: below ? lineTop + block.height : lineTop,
              }
              stageAssetHover(target)
              if (assetHoverShowTimer) return false
              if (assetHoverKeep) {
                // 已显示:即时跟随鼠标,不再延时
                showAssetHover(target)
              } else {
                // 首次悬停:延时浮出
                scheduleAssetHoverShow()
              }
              return false
            }
          }
          hideAssetHoverNow()
          return false
        },
        mouseleave: (event) => {
          // 移到浮层按钮上也会让编辑器收到 mouseleave(按钮不是编辑器子元素),
          // 等待区内不做隐藏,否则按钮悬停即消失
          if (inAssetHoverKeep(event.clientX, event.clientY)) return false
          // 移出图片行立即隐藏
          hideAssetHoverNow()
          return false
        },
        mousedown: (event, view) => {
          // Ctrl/Cmd+点击 assets/ 路径同样可打开(键盘偏好用户的保留路径)
          if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
          if (pos == null) return false
          const hit = assetLinkAt(view, pos)
          if (!hit) return false
          const absolute = assetsPathToAbsolute(hit)
          if (!absolute) return false
          event.preventDefault()
          openAsset(absolute)
          return true
        },
      }),
    [hideAssetHoverNow, noteDir, scheduleAssetHoverShow, showAssetHover, stageAssetHover],
  )

  // 内嵌图片徽章:编辑器里把超长 base64 换成短占位(纯显示层,原文不动)
  // (原实时预览装饰层 markdownLivePreview 已随 CM livePreview 路线退役,
  //  实时预览固定走 TipTap LiveEditorPane——渲染统一第 5 步)
  const imageChipExt = useMemo(() => imagePlaceholder(), [])

  // 菜单/App 通过事件总线触发文件选择器(光标位置由 view 实时决定)
  useEffect(() => {
    const open = () => fileInputRef.current?.click()
    const off = appEvents.on('insertImage', open)
    return () => { off() }
  }, [])

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])]
    e.target.value = '' // 允许再次选择同一文件
    const view = viewRef.current
    if (view && files.length) {
      void insertImageFiles(view, files, view.state.selection.main.head, noteDir ?? null)
    }
  }

  // 折叠箭头:CM 默认用 ⌄/› 字符,在 monospace 字体里墨迹偏上,视觉与行号错位;
  // 换内联 SVG,基线稳定且可以按状态换色
  const foldMarkerDOM = useMemo(
    () => (open: boolean) => {
      const span = document.createElement('span')
      span.title = open ? 'Fold line' : 'Unfold line'
      span.style.cssText = 'display:inline-flex;cursor:pointer;color:inherit'
      span.innerHTML = open
        ? '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2 6.5 5 3.5 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      return span
    },
    [],
  )
  const foldExt = useMemo(
    () =>
      foldGutter({
        markerDOM: (open) => foldMarkerDOM(open),
      }),
    [foldMarkerDOM],
  )

  // 折叠开关:经 Compartment 动态装卸,切换时不重建编辑器(滚动位置与撤销历史保留)
  const foldEnabled = useEditorPrefs((s) => s.foldEnabled)
  const foldComp = useMemo(() => new Compartment(), [])
  useEffect(() => {
    viewRef.current?.dispatch({ effects: foldComp.reconfigure(foldEnabled ? foldExt : []) })
  }, [foldEnabled, foldComp, foldExt])

  // 自动换行开关:同 Compartment 模式。CodeMirror 默认不换行(长行横向滚动),
  // 笔记场景默认开启 lineWrapping
  const lineWrapEnabled = useEditorPrefs((s) => s.lineWrapEnabled)
  const wrapComp = useMemo(() => new Compartment(), [])
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: wrapComp.reconfigure(lineWrapEnabled ? EditorView.lineWrapping : []),
    })
  }, [lineWrapEnabled, wrapComp])

  // 同步滚动:CodeMirror 的滚动容器是内部 .cm-scroller,由 @uiw 在自身
  // effect 中挂载——本组件的 effect 先于它执行,查询必为 null。
  // 用 MutationObserver 等 .cm-scroller 真正出现后再绑定。
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!bindScroller) return
    const root = rootRef.current
    if (!root) return
    let bound = false
    const tryBind = () => {
      const sc = root.querySelector('.cm-scroller')
      if (sc) {
        bindScroller(sc as HTMLElement)
        bound = true
        return true
      }
      return false
    }
    if (tryBind()) return
    const mo = new MutationObserver(() => {
      if (tryBind()) mo.disconnect()
    })
    mo.observe(root, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
      if (bound) bindScroller(null)
    }
  }, [bindScroller])

  // 编辑器区域右键走自定义菜单(shadcn ContextMenu),压掉 WebView2 原生菜单;
  // trigger 自带 select-none,这里用 select-text 覆盖回来,保证编辑器可选中

  /** 右键时递增:强制重算菜单内的选择区相关状态(禁用态/段落勾选) */
  const [menuTick, setMenuTick] = useState(0)

  /** 菜单命令统一入口:拿到当前 EditorView 才执行;编辑器已卸载则忽略 */
  const runView = (fn: (view: EditorView) => void) => {
    const view = viewRef.current
    if (view) fn(view)
  }

  // 菜单打开瞬间计算的选择区快照:menuTick 变化触发重渲染时取值
  const view = viewRef.current
  const selEmpty = menuTick >= 0 && (!view || view.state.selection.main.empty)
  const headingLevel = menuTick >= 0 && view ? currentHeadingLevel(view) : 0

  const copyAsHtml = (v: EditorView) => {
    const text = v.state.sliceDoc(
      v.state.selection.main.from,
      v.state.selection.main.to,
    )
    if (!text) return
    navigator.clipboard
      .writeText(renderStaticHtml(text))
      .then(() => v.focus())
      .catch(() => toast.error('复制失败'))
  }

  const copySimplified = (v: EditorView) => {
    const text = v.state.sliceDoc(
      v.state.selection.main.from,
      v.state.selection.main.to,
    )
    if (!text) return
    navigator.clipboard
      .writeText(simplifyMarkdown(text))
      .then(() => v.focus())
      .catch(() => toast.error('复制失败'))
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={rootRef}
          onContextMenu={() => setMenuTick((t) => t + 1)}
          className="h-full overflow-hidden text-sm select-text"
        >
          <CodeMirror
        value={value}
        onChange={onChange}
        onCreateEditor={(view) => {
          viewRef.current = view
        }}
        height="100%"
        // 关掉 @uiw 默认 light 主题选项(白色背景/行号槽配色),配色完全由上面的扩展接管
        theme="none"
        // 行号与折叠槽都从 basicSetup 摘出来手动排:折叠槽注册在行号之前,
        // 箭头在行号左侧(VSCode 同款解剖)——否则 12px 空折叠槽会插在行号和
        // 正文之间,数字悬浮、左右边距肉眼不对称
        basicSetup={{ foldGutter: false, lineNumbers: false }}
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          // 右键菜单里标注的快捷键在这里绑定(Ctrl+1..6/0 标题,Ctrl+T 表格等)
          keymap.of([
            { key: 'Mod-1', run: (v) => (setHeading(v, 1), true) },
            { key: 'Mod-2', run: (v) => (setHeading(v, 2), true) },
            { key: 'Mod-3', run: (v) => (setHeading(v, 3), true) },
            { key: 'Mod-4', run: (v) => (setHeading(v, 4), true) },
            { key: 'Mod-5', run: (v) => (setHeading(v, 5), true) },
            { key: 'Mod-6', run: (v) => (setHeading(v, 6), true) },
            { key: 'Mod-0', run: (v) => (setHeading(v, 0), true) },
            { key: 'Mod-t', run: (v) => (insertTable(v), true) },
            { key: 'Mod-Shift-k', run: (v) => (insertCodeBlock(v), true) },
            { key: 'Mod-Shift-m', run: (v) => (insertMathBlock(v), true) },
            { key: 'Mod-Shift-i', run: () => (appEvents.emit('insertImage'), true) },
          ]),
          themeExt,
          chromeExt,
          // 查找替换面板(Mod-f,basicSetup 的 searchKeymap 提供快捷键):
          // top = 面板置顶不遮正文;样式在 index.css 用 shadcn 令牌接管
          search({ top: true }),
          foldComp.of(foldEnabled ? foldExt : []),
          wrapComp.of(lineWrapEnabled ? EditorView.lineWrapping : []),
          cmLineNumbers(),
          fontExt,
          imageExt,
          imageChipExt,
        ]}
      />
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
              const target = assetsPathToAbsolute(assetHover.path)
              hideAssetHoverNow()
              if (target) openAsset(target)
            }}
            onMouseLeave={(e) => {
              // 从按钮移回图片行时按钮不能闪没:指针还在等待区内交给编辑器
              // mousemove 维持;甩出去(侧栏/窗外)才隐藏
              if (!inAssetHoverKeep(e.clientX, e.clientY)) hideAssetHoverNow()
            }}
          >
            <FolderOpen />
            打开图片位置
          </Button>,
          document.body,
        )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-56">
        {/* 剪贴板图标网格(Typora 同款):无选中时剪切/复制/删除置灰;不加水平 padding,靠均分居中保证左右对称 */}
        <div className="grid grid-cols-4 gap-1 px-1.5 pt-2">
          <MenuIconBtn
            icon={Scissors}
            title="剪切"
            disabled={selEmpty}
            onSelect={() => runView((v) => cutSelection(v).catch(() => toast.error('剪切失败')))}
          />
          <MenuIconBtn
            icon={Copy}
            title="复制"
            disabled={selEmpty}
            onSelect={() => runView((v) => copySelection(v).catch(() => toast.error('复制失败')))}
          />
          <MenuIconBtn
            icon={ClipboardPaste}
            title="粘贴"
            onSelect={() => runView((v) => pasteClipboard(v).catch(() => toast.error('粘贴失败')))}
          />
          <MenuIconBtn
            icon={Trash2}
            title="删除"
            disabled={selEmpty}
            onSelect={() => runView(deleteSelection)}
          />
        </div>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">复制 / 粘贴为…</ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-56">
            <ContextMenuItem
              disabled={selEmpty}
              onSelect={() => runView((v) => copySelection(v).catch(() => toast.error('复制失败')))}
            >
              复制为 Markdown
              <ContextMenuShortcut>Ctrl+Shift+C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem
              disabled={selEmpty}
              onSelect={() => runView(copyAsHtml)}
            >
              复制为 HTML 代码
            </ContextMenuItem>
            <ContextMenuItem
              disabled={selEmpty}
              onSelect={() => runView(copySimplified)}
            >
              复制内容并简化格式
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => runView((v) => pasteClipboard(v).catch(() => toast.error('粘贴失败')))}
            >
              粘贴为纯文本
              <ContextMenuShortcut>Ctrl+Shift+V</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        {/* 格式图标网格:行内(加粗/斜体/行内代码/链接)+ 块级(引用/有序/无序/任务) */}
        <div className="grid grid-cols-4 gap-1 px-1.5 py-1.5">
          <MenuIconBtn icon={Bold} title="加粗" onSelect={() => runView((v) => toggleInline(v, '**'))} />
          <MenuIconBtn icon={Italic} title="斜体" onSelect={() => runView((v) => toggleInline(v, '*'))} />
          <MenuIconBtn icon={Code} title="行内代码" onSelect={() => runView((v) => toggleInline(v, '`'))} />
          <MenuIconBtn icon={Link2} title="链接" onSelect={() => runView(insertLink)} />
          <MenuIconBtn icon={TextQuote} title="引用" onSelect={() => runView((v) => toggleLinePrefix(v, 'quote'))} />
          <MenuIconBtn icon={ListOrdered} title="有序列表" onSelect={() => runView((v) => toggleLinePrefix(v, 'olist'))} />
          <MenuIconBtn icon={List} title="无序列表" onSelect={() => runView((v) => toggleLinePrefix(v, 'ulist'))} />
          <MenuIconBtn icon={ListTodo} title="任务列表" onSelect={() => runView((v) => toggleLinePrefix(v, 'task'))} />
        </div>
        {/* 段落/插入:Typora 同款二级结构,转换作用于选中行;当前层级打勾 */}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">段落</ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-44">
            {([1, 2, 3, 4, 5, 6] as const).map((level) => (
              <ContextMenuItem key={level} onSelect={() => runView((v) => setHeading(v, level))}>
                {headingLevel === level && <Check className="size-3.5" />}
                {level} 级标题
                <ContextMenuShortcut>Ctrl+{level}</ContextMenuShortcut>
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => runView((v) => setHeading(v, 0))}>
              {headingLevel === 0 && <Check className="size-3.5" />}
              段落
              <ContextMenuShortcut>Ctrl+0</ContextMenuShortcut>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">插入</ContextMenuSubTrigger>
          <ContextMenuSubContent className="min-w-44">
            <ContextMenuItem onSelect={() => appEvents.emit('insertImage')}>
              图像
              <ContextMenuShortcut>Ctrl+Shift+I</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => runView(insertFootnote)}>脚注</ContextMenuItem>
            <ContextMenuItem onSelect={() => runView(insertRefLink)}>链接引用</ContextMenuItem>
            <ContextMenuItem onSelect={() => runView(insertHorizontalRule)}>水平分割线</ContextMenuItem>
            <ContextMenuItem onSelect={() => runView(insertTable)}>
              表格
              <ContextMenuShortcut>Ctrl+T</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => runView(insertCodeBlock)}>
              代码块
              <ContextMenuShortcut>Ctrl+Shift+K</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => runView(insertMathBlock)}>
              公式块
              <ContextMenuShortcut>Ctrl+Shift+M</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => runView(insertToc)}>内容目录</ContextMenuItem>
            <ContextMenuItem onSelect={() => runView(insertYamlFrontMatter)}>YAML Front Matter</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => runView(insertParagraphAbove)}>段落（上方）</ContextMenuItem>
            <ContextMenuItem onSelect={() => runView(insertParagraphBelow)}>段落（下方）</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  )
}
