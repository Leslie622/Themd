import hljsThemeCss from 'highlight.js/styles/github.css?raw'
import themeBaseCss from '@/styles/theme-base.css?raw'

import { md } from '@/lib/markdown'
import { compileTokens, extraCssToStyle } from '@/lib/theme/compile'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'
import type { Note } from '@/store'

/** store 的主题切片形状(themes + activeId) */
type ThemeSlice = ReturnType<typeof useThemeStore.getState>

/**
 * 导出独立 HTML:复用预览的渲染管线(md.render + 主题令牌编译 + 附加 CSS),
 * 把预览的完整观感内联成单文件——离线可开、样式自包含、不依赖应用。
 * 打印/导出 PDF 的视觉与此一致(应用内打印走同一套 .themd-prose 样式)。
 */

/** 解析笔记生效主题:笔记级覆盖 > 全局激活(与 PreviewPane 同逻辑) */
function resolveNoteTheme(
  noteThemeId: string | undefined,
  { themes, activeId }: Pick<ThemeSlice, 'themes' | 'activeId'>,
) {
  if (noteThemeId) {
    const overridden = listAllThemes({ themes, activeId }).find(
      (t) => t.id === noteThemeId,
    )
    if (overridden) return overridden
  }
  return resolveActiveTheme({ themes, activeId })
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function buildStandaloneHtml(note: Note): string {
  const isDark = useAppearance.getState().isDark
  const { themes, activeId } = useThemeStore.getState()
  const theme = resolveNoteTheme(note.themeId, { themes, activeId })
  // 变量声明在 :root,body 与 .themd-prose 都能消费(如 --t-root-bg 作页面底色)
  const vars = Object.entries(compileTokens(theme.tokens, theme.dark, isDark))
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')
  const extraCss = theme.extraCss?.trim()
    ? extraCssToStyle(theme.id, theme.extraCss)
    : ''

  return `<!doctype html>
<html lang="zh-CN" data-color-scheme="${isDark ? 'dark' : 'light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Themd">
<title>${escapeHtml(note.title || '未命名笔记')}</title>
<style>
:root { ${vars} color-scheme: ${isDark ? 'dark' : 'light'}; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--t-root-bg, ${isDark ? '#0f0f10' : '#ffffff'});
  min-height: 100vh;
}
.themd-prose { margin: 0 auto; padding: 48px 32px; }
@media print {
  body { background: none; }
  .themd-prose { padding: 0; max-width: none; }
}
</style>
<style>
${themeBaseCss}
</style>
<style>
${hljsThemeCss}
</style>
${extraCss ? `<style>\n${extraCss}\n</style>` : ''}
</head>
<body>
<article class="themd-prose">
${md.render(note.content)}
</article>
</body>
</html>
`
}

/** 触发浏览器下载独立 HTML 文件 */
export function downloadNoteHtml(note: Note): void {
  const blob = new Blob([buildStandaloneHtml(note)], {
    type: 'text/html;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${note.title || 'note'}.html`
  a.click()
  URL.revokeObjectURL(url)
}
