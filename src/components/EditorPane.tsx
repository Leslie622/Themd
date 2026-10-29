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
import { fileToEmbeddedImage, insertImageMarkdown } from '@/lib/image'
import { useAppearance } from '@/store-appearance'
import { buildFontStack, useEditorPrefs } from '@/store-editor'

/** 批量处理图片文件并插入;全部为图片才接管事件,返回是否接管 */
async function insertImageFiles(
  view: EditorView,
  files: File[],
  pos: number,
): Promise<boolean> {
  if (!files.length || !files.every((f) => f.type.startsWith('image/'))) return false
  const alt = (name: string) => name.replace(/\.[^.]+$/, '') || '图片'
  toast.info(files.length > 1 ? `正在插入 ${files.length} 张图片…` : '正在插入图片…')
  let at = pos
  let ok = 0
  for (const file of files) {
    try {
      const dataUrl = await fileToEmbeddedImage(file)
      insertImageMarkdown(view, at, dataUrl, alt(file.name))
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

/**
 * CodeMirror 编辑器封装。
 * 语法配色用 GitHub Light/Dark 跟随明暗开关,与内置 GitHub 渲染主题呼应;
 * 背景/行号槽/活动行设为透明或语义令牌色,编辑区观感与整体 UI 联动。
 * 字体默认跟产品 UI;设置抽屉自定义后按设置走。
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
  // 编辑器字体默认跟产品 UI(index.css 的 .cm-editor 消费 --font-ui-sans);
  // 设置里自定义后 store 注入 --font-editor。无论哪种,都要用样式模块覆盖
  // .cm-scroller——CodeMirror 基础主题在那里硬编码了 monospace
  const editorFont = useEditorPrefs((s) =>
    s.editorFontWestern || s.editorFontCjk
      ? buildFontStack(s.editorFontWestern, s.editorFontCjk, 'monospace')
      : 'var(--font-ui-sans)', // 未自定义 = 跟随产品界面
  )

  const fontExt = useMemo(
    () =>
      EditorView.theme({
        '&': { fontFamily: editorFont },
        '.cm-scroller': { fontFamily: editorFont },
        // 行号必须等宽对齐:未自定义编辑器字体时 .cm-scroller 走 UI 比例字体
        // (Geist),数字 30/31 宽窄不一;行号槽单独用 --font-mono——
        // 自定义编辑器字体时 store 已注入 --font-editor,行号自动跟随;
        // 未自定义时回落系统等宽链。tabular-nums 兜底数字宽度
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
        // 行号区几何:「左空白|箭头|行号|右空白」左右等宽(10px),箭头+行号作为
        // 一个整体居中——折叠槽 20px = 左空白 10px + 箭头 10px(贴右,紧邻行号),
        // 行号槽只带右侧 10px,两侧空白必然相等,与折叠箭头显隐无关
        '.cm-lineNumbers .cm-gutterElement': {
          padding: '0 10px 0 0',
          textAlign: 'center',
        },
        '.cm-foldGutter .cm-gutterElement': {
          width: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0',
        },
        // 关闭折叠开关后折叠槽消失,行号槽自带左空白,保持左右对称
        '.cm-gutters:not(:has(.cm-foldGutter)) .cm-lineNumbers .cm-gutterElement': {
          paddingLeft: '10px',
        },
      }),
    [],
  )

  // 图片插入:粘贴截图 / 拖拽文件 / 菜单选择(经 themd:insert-image 事件)三入口
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
      }),
    [],
  )

  // 内嵌图片徽章:编辑器里把超长 base64 换成短占位(纯显示层,原文不动)
  const imageChipExt = useMemo(() => imagePlaceholder(), [])

  // 菜单/App 通过事件总线触发文件选择器(光标位置由 view 实时决定)
  useEffect(() => {
    const open = () => fileInputRef.current?.click()
    window.addEventListener('themd:insert-image', open)
    return () => window.removeEventListener('themd:insert-image', open)
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
