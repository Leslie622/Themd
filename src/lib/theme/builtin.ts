import type { ThemeFile } from './schema'
import type { ThemeTokens } from './tokens'

/**
 * 内置主题。极简 = tokens 为空（回落值即它）；GitHub = 复刻 github.com 亮色渲染。
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

/** 衬线墨水：宋体正文 + 暖纸感，长文阅读向 */
const SERIF_INK: ThemeFile = {
  version: 1,
  id: 'serif-ink',
  name: '衬线墨水',
  builtin: true,
  tokens: {
    'root.font': "'Songti SC', 'SimSun', 'Noto Serif SC', serif",
    'root.size': '17px',
    'root.leading': '1.9',
    'root.width': '44rem',
    'root.spacing': '0.02em',
    'heading.font': "'Songti SC', 'SimSun', 'Noto Serif SC', serif",
    'heading.weight': '700',
    'p.indent': '2em',
    'p.marginBottom': '0.8em',
    'quote.borderColor': '#b98a5e',
    'quote.bg': '#faf6f0',
    'quote.color': '#6b5d4f',
    'inlineCode.bg': '#f3ede4',
    'inlineCode.color': '#8a4b2a',
    'codeBlock.bg': '#faf6f0',
    'codeBlock.borderWidth': '1px',
    'codeBlock.borderColor': '#e8ddcc',
    'table.stripeBg': '#faf6f0',
    'th.bg': '#f3ede4',
    'hr.color': '#e8ddcc',
    'a.color': '#8a4b2a',
    'a.underline': 'always',
  } satisfies ThemeTokens,
}

/** 暗色终端：深底亮字，代码笔记向（预览区局部深色，不影响应用界面） */
const DARK_TERMINAL: ThemeFile = {
  version: 1,
  id: 'dark-terminal',
  name: '暗色终端',
  builtin: true,
  tokens: {
    'root.color': '#d4d4d8',
    'root.bg': '#18181b',
    'root.leading': '1.7',
    'heading.color': '#fafafa',
    'heading.weight': '600',
    'h1.borderWidth': '1px',
    'h1.borderColor': '#3f3f46',
    'h1.paddingBottom': '0.3em',
    'h2.borderWidth': '1px',
    'h2.borderColor': '#3f3f46',
    'h2.paddingBottom': '0.3em',
    'h6.color': '#a1a1aa',
    'a.color': '#7dd3fc',
    'a.underline': 'hover',
    'strong.color': '#fde047',
    'em.color': '#c4b5fd',
    'inlineCode.color': '#86efac',
    'inlineCode.bg': '#27272a',
    'inlineCode.radius': '4px',
    'codeBlock.bg': '#18181b',
    'codeBlock.borderWidth': '1px',
    'codeBlock.borderColor': '#3f3f46',
    'codeBlock.radius': '6px',
    'quote.color': '#a1a1aa',
    'quote.borderColor': '#7dd3fc',
    'quote.bg': '#1c1c1f',
    'quote.radius': '0 6px 6px 0',
    'quote.padding': '0.75em 1em',
    'table.borderColor': '#3f3f46',
    'th.bg': '#27272a',
    'table.stripeBg': '#1f1f23',
    'ul.markerColor': '#7dd3fc',
    'ol.markerColor': '#7dd3fc',
    'task.accent': '#7dd3fc',
    'hr.color': '#3f3f46',
    'img.borderColor': '#3f3f46',
    'img.borderWidth': '1px',
    'img.radius': '6px',
  } satisfies ThemeTokens,
}

export const BUILTIN_THEMES: ThemeFile[] = [MINIMAL, GITHUB, SERIF_INK, DARK_TERMINAL]
