import hljsThemeCss from 'highlight.js/styles/github.css?raw'
import katexCss from 'katex/dist/katex.min.css?raw'
import themeBaseCss from '@/styles/theme-base.css?raw'

import { renderStaticHtml } from './static-html'
import { compileTokens, extraCssToStyle } from '@/lib/theme/compile'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useAppearance } from '@/store-appearance'
import type { Note } from '@/modules/notebook/domain/note'

/** store 的主题切片形状(themes + activeId) */
type ThemeSlice = ReturnType<typeof useThemeStore.getState>

/**
 * 导出独立 HTML:复用预览的渲染管线(TipTap 静态序列化 + 主题令牌编译 +
 * 附加 CSS),把预览的完整观感内联成单文件——离线可开、样式自包含、不依赖应用。
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
  /* 画布背景优先(app.bg 铺整页),未设则回落纸张颜色 */
  background: var(--t-app-bg, var(--t-root-bg, ${isDark ? '#0f0f10' : '#ffffff'}));
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
<style>
${katexCss}
</style>
${extraCss ? `<style>\n${extraCss}\n</style>` : ''}
</head>
<body>
<article class="themd-prose">
${renderStaticHtml(note.content)}
</article>
</body>
</html>
`
}


export const renderStandaloneHtml = buildStandaloneHtml

/**
 * mermaid 导出预热:导出的独立 HTML 无运行时 JS,占位容器必须在写文件前
 * 烤成已渲染的 SVG(代码哈希缓存命中零成本;渲染失败保留源码文本兜底,
 * 与预览挂载后的降级行为一致)。保留 div.themd-mermaid 包装(样式钩子不变)。
 */
async function prewarmMermaid(html: string, isDark: boolean): Promise<string> {
  if (!html.includes('class="themd-mermaid"')) return html
  const { renderMermaidSvg } = await import('@/modules/live-editor/infrastructure/mermaid-render')
  const re = /<div class="themd-mermaid" data-src="([^"]*)">[\s\S]*?<\/div>/g
  let out = ''
  let last = 0
  for (const m of html.matchAll(re)) {
    let inner = m[0].slice(m[0].indexOf('>') + 1, -'</div>'.length)
    const src = decodeURIComponent(m[1] ?? '')
    if (src) {
      try {
        inner = await renderMermaidSvg(src, isDark)
      } catch {
        // 保留源码文本兜底
      }
    }
    out += `${html.slice(last, m.index)}<div class="themd-mermaid" data-src="${m[1]}">${inner}</div>`
    last = (m.index ?? 0) + m[0].length
  }
  return out + html.slice(last)
}

/** 导出用:构建独立 HTML 并预热 mermaid(异步,写文件前完成) */
export async function renderStandaloneHtmlForExport(note: Note): Promise<string> {
  const isDark = useAppearance.getState().isDark
  return prewarmMermaid(buildStandaloneHtml(note), isDark)
}

