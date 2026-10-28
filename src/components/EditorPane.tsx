import CodeMirror from '@uiw/react-codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { EditorView } from '@codemirror/view'
import { useMemo } from 'react'

import { resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'

/**
 * CodeMirror 编辑器封装。P5:编辑区字体跟随激活主题的 root.font
 * （主题只管渲染观感,但正文字体在编辑/预览两侧保持一致更符合直觉）。
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

  return (
    <div className="h-full overflow-hidden text-sm">
      <CodeMirror
        value={value}
        onChange={onChange}
        height="100%"
        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages }), fontExt]}
      />
    </div>
  )
}
