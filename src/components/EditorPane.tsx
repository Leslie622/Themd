import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import {
  defaultSettingsGithubDark,
  defaultSettingsGithubLight,
  githubDarkInit,
  githubLightInit,
} from '@uiw/codemirror-theme-github'
import { useMemo } from 'react'

import { resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'

/**
 * CodeMirror 编辑器封装。
 * 语法配色用 GitHub Light/Dark 跟随明暗开关,与内置 GitHub 渲染主题呼应;
 * 背景/行号槽/活动行设为透明或语义令牌色,编辑区观感与整体 UI 联动。
 */
export function EditorPane({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const activeId = useThemeStore((s) => s.activeId)
  const themes = useThemeStore((s) => s.themes)
  const isDark = useAppearance((s) => s.isDark)
  const theme = useMemo(
    () => resolveActiveTheme({ themes, activeId }),
    [themes, activeId],
  )
  const fontToken = (isDark ? theme.dark?.['root.font'] : undefined) ?? theme.tokens['root.font']

  const fontExt = useMemo(() => {
    if (!fontToken) return []
    // CodeMirror 默认字体声明在 .cm-scroller 上,须同选择器覆盖(写 '&' 会被它压掉)
    return [EditorView.theme({
      '&': { fontFamily: fontToken },
      '.cm-scroller': { fontFamily: fontToken },
    })]
  }, [fontToken])

  // GitHub 语法配色;背景/行号槽/活动行透明化,观感交给下面的令牌样式
  const themeExt = useMemo(
    () =>
      isDark
        ? githubDarkInit({
            settings: {
              ...defaultSettingsGithubDark,
              background: 'transparent',
              gutterBackground: 'transparent',
              lineHighlight: 'transparent',
            },
          })
        : githubLightInit({
            settings: {
              ...defaultSettingsGithubLight,
              background: 'transparent',
              gutterBackground: 'transparent',
              lineHighlight: 'transparent',
            },
          }),
    [isDark],
  )

  // 行号槽/活动行/光标走 shadcn 语义令牌;须排在 themeExt 之后,CodeMirror
  // 的样式模块按插入顺序取胜(普通 css 会被两者都压掉,见 index.css 注释)
  const chromeExt = useMemo(
    () =>
      EditorView.theme({
        '.cm-gutters': {
          borderRight: '1px solid color-mix(in oklch, var(--border) 60%, transparent)',
          color: 'color-mix(in oklch, var(--muted-foreground) 55%, transparent)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'color-mix(in oklch, var(--accent) 45%, transparent)',
          color: 'var(--foreground)',
        },
        '.cm-activeLine': {
          backgroundColor: 'color-mix(in oklch, var(--accent) 30%, transparent)',
        },
        '.cm-caret': { color: 'var(--primary)' },
      }),
    [],
  )

  return (
    <div className="h-full overflow-hidden text-sm">
      <CodeMirror
        value={value}
        onChange={onChange}
        height="100%"
        // 关掉 @uiw 默认 light 主题选项(白色背景/行号槽配色),配色完全由上面的扩展接管
        theme="none"
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          themeExt,
          chromeExt,
          fontExt,
        ]}
      />
    </div>
  )
}
