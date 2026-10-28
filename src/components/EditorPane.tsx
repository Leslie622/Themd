import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { foldGutter } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import {
  defaultSettingsGithubDark,
  defaultSettingsGithubLight,
  githubDarkInit,
  githubLightInit,
} from '@uiw/codemirror-theme-github'
import { useEffect, useMemo, useRef } from 'react'

import { useAppearance } from '@/store-appearance'
import { buildFontStack, useEditorPrefs } from '@/store-editor'

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
              gutterBackground: 'color-mix(in oklch, var(--muted) 45%, transparent)',
              gutterBorder: 'color-mix(in oklch, var(--border) 60%, transparent)',
              lineHighlight: 'transparent',
            },
          })
        : githubLightInit({
            settings: {
              ...defaultSettingsGithubLight,
              background: 'transparent',
              gutterBackground: 'color-mix(in oklch, var(--muted) 45%, transparent)',
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
      }),
    [],
  )

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
        height="100%"
        // 关掉 @uiw 默认 light 主题选项(白色背景/行号槽配色),配色完全由上面的扩展接管
        theme="none"
        // 内置 foldGutter 用字符箭头(视觉错位),关掉换上面自定义 SVG 版
        basicSetup={{ foldGutter: false }}
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          themeExt,
          chromeExt,
          foldExt,
          fontExt,
        ]}
      />
    </div>
  )
}
