import { memo, useMemo } from 'react'
import 'highlight.js/styles/github.css'

import { renderMarkdown } from '@/modules/rendering/markdown-renderer'
import { compileTokens } from '@/lib/theme/compile'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'
import { useExtraCss } from '@/components/theme/useExtraCss'

/**
 * 预览面板：md.render → .themd-prose 排版。
 * 样式链路：主题令牌 → compileTokens → 容器 style 变量 → theme-base.css 消费。
 * 主题来源优先级:笔记级覆盖(noteThemeId) > 全局激活主题。
 * 有暗色令牌套时按应用暗色模式选择;附加 CSS 经 useExtraCss 作用域注入。
 */
export const PreviewPane = memo(function PreviewPane({
  content,
  noteThemeId,
  bindScroller,
}: {
  content: string
  /** 本篇笔记的主题覆盖(P5);未设置跟随全局 */
  noteThemeId?: string
  /** 绑定滚动容器,用于编辑/预览同步滚动 */
  bindScroller?: (el: HTMLElement | null) => void
}) {
  const html = useMemo(() => renderMarkdown(content).html, [content])

  const activeId = useThemeStore((s) => s.activeId)
  const themes = useThemeStore((s) => s.themes)
  const theme = useMemo(() => {
    if (noteThemeId) {
      // listAllThemes = 内置 + 用户主题;笔记覆盖选内置主题时也能命中
      // (id 失效如主题已删除,则回落全局)
      const overridden = listAllThemes({ themes, activeId }).find(
        (t) => t.id === noteThemeId,
      )
      if (overridden) return overridden
    }
    return resolveActiveTheme({ themes, activeId })
  }, [themes, activeId, noteThemeId])
  const isDark = useAppearance((s) => s.isDark)
  const cssVars = useMemo(
    () => compileTokens(theme.tokens, theme.dark, isDark),
    [theme, isDark],
  )
  useExtraCss(theme.id, theme.extraCss)

  return (
    <div ref={bindScroller} className="h-full overflow-y-auto">
      <article
        className="themd-prose mx-auto px-6 py-8"
        style={cssVars as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})
