import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { foldGutter } from '@codemirror/language'
import { Compartment } from '@codemirror/state'
import { EditorView, lineNumbers as cmLineNumbers } from '@codemirror/view'
import {
  defaultSettingsGithubDark,
  defaultSettingsGithubLight,
  githubDarkInit,
  githubLightInit,
} from '@uiw/codemirror-theme-github'
import { useEffect, useMemo, useRef, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { imagePlaceholder } from '@/lib/image-decorator'
import { fileToAssetImage, fileToEmbeddedImage, insertImageMarkdown } from '@/lib/image'
import { assetsPathToAbsolute } from '@/lib/image-src'
import { platformServices } from '@/app/platform'
import { useAppearance } from '@/store-appearance'
import { appEvents } from '@/shared/events/app-events'
import { DEFAULT_EDITOR_STACK, buildFontStack, useEditorPrefs } from '@/store-editor'

/** 批量处理图片文件并插入;全部为图片才接管事件,返回是否接管 */
async function insertImageFiles(
  view: EditorView,
  files: File[],
  pos: number,
): Promise<boolean> {
  if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return false
  const alt = (name: string) => name.replace(/\.[^.]+$/, '') || '图片'
  toast.info(files.length > 1 ? `正在插入 ${files.length} 张图片…` : '正在插入图片…')
  // 本地 assets 模式:图片落盘 `${root}/assets/`,正文引用相对路径;
  // assetsRoot 未自定义时用平台默认(桌面端应用数据目录)。Web 端 gateway 无能力,
  // UI 已强制 embedded,这里兜底回落内嵌,不因模式残留导致插入失败
  const { imageMode, assetsRoot } = useEditorPrefs.getState()
  const useAssets = imageMode === 'assets' && platformServices.isDesktop
  const root = useAssets && assetsRoot.trim()
    ? assetsRoot.trim()
    : await platformServices.files.defaultAssetsRoot()
  let at = pos
  let ok = 0
  for (const file of files) {
    try {
      const insertValue = useAssets
        ? (await fileToAssetImage(file, root, platformServices.files.writeBinaryFile)).relativePath
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

/** hover 浮层:全局单例按钮,挂 body 上,点击打开命中的图片 */
let assetHoverEl: HTMLButtonElement | null = null
let assetHoverTimer: ReturnType<typeof setTimeout> | undefined

function showAssetHoverButton(x: number, y: number, relativePath: string): void {
  if (assetHoverTimer) {
    clearTimeout(assetHoverTimer)
    assetHoverTimer = undefined
  }
  if (!assetHoverEl) {
    assetHoverEl = document.createElement('button')
    assetHoverEl.type = 'button'
    assetHoverEl.textContent = '打开图片位置'
    assetHoverEl.style.cssText =
      'position:fixed;z-index:60;display:none;transform:translate(8px,14px);padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:var(--popover);color:var(--popover-foreground);font-size:12px;line-height:1.6;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:nowrap'
    assetHoverEl.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const target = assetHoverEl?.dataset.path
      hideAssetHoverButton()
      if (target) openAsset(target)
    })
    document.body.appendChild(assetHoverEl)
  }
  assetHoverEl.dataset.path = assetsPathToAbsolute(relativePath) ?? ''
  assetHoverEl.style.left = `${x}px`
  assetHoverEl.style.top = `${y}px`
  assetHoverEl.style.display = 'block'
}

function hideAssetHoverButton(): void {
  if (!assetHoverEl || assetHoverEl.style.display === 'none') return
  // 延迟 150ms 再隐藏:给鼠标从路径文本移到按钮上的间隙,
  // 期间再次 hover 会取消定时器,按钮不闪
  assetHoverTimer = setTimeout(() => {
    if (assetHoverEl) assetHoverEl.style.display = 'none'
    assetHoverTimer = undefined
  }, 150)
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
}: {
  value: string
  onChange: (value: string) => void
  /** 绑定内部滚动容器(.cm-scroller),用于编辑/预览同步滚动 */
  bindScroller?: (el: HTMLElement | null) => void
}) {
  const isDark = useAppearance((s) => s.isDark)
  // CodeMirror view 引用:粘贴/拖拽/菜单插图都要在精确光标处 dispatch
  const viewRef = useRef<EditorView | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
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
          void insertImageFiles(view, files, view.state.selection.main.head)
          return true
        },
        drop: (event, view) => {
          const files = [...(event.dataTransfer?.files ?? [])]
          if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return false
          event.preventDefault()
          const pos =
            view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
            view.state.selection.main.head
          void insertImageFiles(view, files, pos)
          return true
        },
        dragover: (event) => {
          // 不阻止默认行为,浏览器会直接打开拖入的图片文件
          if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
          return false
        },
        mousemove: (event, view) => {
          // hover assets/ 路径:浮出「打开图片位置」按钮(共享单例浮层)。
          // posAtCoords 对视口外坐标会就近吸附到最近行,必须先用行包围盒
          // 做几何判定,否则鼠标离开路径后按钮不消失。
          // lineBlockAtHeight 收文档坐标:clientY 换算 = 视口y - 编辑器top + 滚动量
          const editorTop = view.dom.getBoundingClientRect().top
          const docY = event.clientY - editorTop + view.scrollDOM.scrollTop
          const block = view.lineBlockAtHeight(docY)
          const inside =
            event.clientY >= block.top - view.scrollDOM.scrollTop + editorTop &&
            event.clientY <= block.top - view.scrollDOM.scrollTop + editorTop + block.height &&
            event.clientX >= view.scrollDOM.getBoundingClientRect().left &&
            event.clientX <= view.scrollDOM.getBoundingClientRect().right
          const hit = inside ? assetLinkAt(view, view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? 0) : null
          if (hit) {
            showAssetHoverButton(event.clientX, event.clientY, hit)
          } else {
            hideAssetHoverButton()
          }
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
    [],
  )

  // 内嵌图片徽章:编辑器里把超长 base64 换成短占位(纯显示层,原文不动)
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
      void insertImageFiles(view, files, view.state.selection.main.head)
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

  return (
    <div ref={rootRef} className="h-full overflow-hidden text-sm">
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
          themeExt,
          chromeExt,
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
    </div>
  )
}
