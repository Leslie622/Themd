import type { ThemeFile } from './schema'
import type { ThemeTokens } from './tokens'

/**
 * 内置主题（精选两套）：极简 = tokens 为空（回落值即它，是地基不是仿品）；
 * GitHub = 对齐 github.com 渲染观感。带血统声明的主题,令牌值须从源头
 * 转写并在注释注明来源版本,不许凭印象填。
 * 新增内置主题：在这里加一条即可（store 会自动合并）。
 */

const MINIMAL: ThemeFile = {
  version: 1,
  id: 'default',
  name: '极简',
  builtin: true,
  tokens: {},
}

/** GitHub 亮色（github.com 2024 视觉） */
const GITHUB: ThemeFile = {
  version: 1,
  id: 'github',
  name: 'GitHub',
  builtin: true,
  tokens: {
    // 正文
    'root.size': '16px',
    'root.leading': '1.6',
    'root.width': '64rem',
    // 标题
    'heading.weight': '600',
    'heading.leading': '1.25',
    'heading.marginTop': '1.5em',
    'heading.marginBottom': '0.5em',
    'h1.size': '2em',
    'h1.borderWidth': '1px',
    'h1.borderColor': '#d1d9e0',
    'h1.paddingBottom': '0.3em',
    'h2.size': '1.5em',
    'h2.borderWidth': '1px',
    'h2.borderColor': '#d1d9e0',
    'h2.paddingBottom': '0.3em',
    'h3.size': '1.25em',
    'h4.size': '1em',
    'h5.size': '0.875em',
    'h6.size': '0.85em',
    'h6.color': '#59636e',
    // 行内
    'a.color': '#0969da',
    'a.underline': 'hover',
    'strong.weight': '600',
    // 行内代码
    'inlineCode.size': '85%',
    'inlineCode.bg': '#818b981f',
    'inlineCode.padding': '0.2em 0.4em',
    'inlineCode.radius': '6px',
    // 代码块
    'codeBlock.bg': '#f6f8fa',
    'codeBlock.size': '85%',
    'codeBlock.leading': '1.45',
    'codeBlock.padding': '16px',
    'codeBlock.radius': '6px',
    // 列表
    'list.indent': '2em',
    'li.spacing': '0.25em',
    // 引用
    'quote.color': '#59636e',
    'quote.borderColor': '#d1d9e0',
    // 表格
    'table.borderColor': '#d1d9e0',
    'th.bg': '#f6f8fa',
    // hr
    'hr.color': '#d1d9e0',
  } satisfies ThemeTokens,
}

export const BUILTIN_THEMES: ThemeFile[] = [MINIMAL, GITHUB]
