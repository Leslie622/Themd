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

/**
 * GitHub：值逐项转写自 github-markdown-css v5.9.0（从 github.com 真实
 * .markdown-body 样式生成的包），亮/暗两面对照其 light/dark 两个 css 文件。
 * 表达不了的项在此注明：li 内段落收口、kbd 键帽样式。单元格全网格线已由
 * cell.border 令牌表达（源 th/td 四边 1px;行分隔线的 b3 透明度并入了网格线
 * 同色,视觉无差）。root.width 源文件未定（容器级），取 GitHub 阅读容器
 * ~1012px 的近似 64rem。表头无底色、复选框不设 accent——均与源一致
 * （有意不设，勿"补"）。
 */
const GITHUB: ThemeFile = {
  version: 1,
  id: 'github',
  name: 'GitHub',
  builtin: true,
  tokens: {
    // 正文(.markdown-body)
    'root.font':
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    'root.size': '16px',
    'root.leading': '1.5',
    'root.color': '#1f2328',
    'root.bg': '#ffffff',
    'root.width': '64rem',
    'p.marginBottom': '10px',
    // 标题(共用组: weight 600 / line-height 1.25 / margin 1.5rem 0 1rem)
    'heading.weight': '600',
    'heading.leading': '1.25',
    'heading.marginTop': '1.5rem',
    'heading.marginBottom': '1rem',
    'h1.size': '2em',
    'h1.borderWidth': '1px',
    'h1.borderColor': '#d1d9e0b3',
    'h1.paddingBottom': '.3em',
    'h2.size': '1.5em',
    'h2.borderWidth': '1px',
    'h2.borderColor': '#d1d9e0b3',
    'h2.paddingBottom': '.3em',
    'h3.size': '1.25em',
    'h4.size': '1em',
    'h5.size': '.875em',
    'h6.size': '.85em',
    'h6.color': '#59636e',
    // 行内(a: #0969da + 常 underline,offset .2rem;strong 600)
    'a.color': '#0969da',
    'a.underline': 'always',
    'strong.weight': '600',
    // 行内代码(code,tt: 85% / .2em .4em / #818b981f / 6px)
    'inlineCode.font':
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    'inlineCode.size': '85%',
    'inlineCode.bg': '#818b981f',
    'inlineCode.padding': '.2em .4em',
    'inlineCode.radius': '6px',
    // 代码块(pre: 85% / 1.45 / 1rem / #f6f8fa / 6px,无边框)
    'codeBlock.font':
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    'codeBlock.size': '85%',
    'codeBlock.leading': '1.45',
    'codeBlock.padding': '1rem',
    'codeBlock.radius': '6px',
    'codeBlock.bg': '#f6f8fa',
    // 列表(padding-left 2em; li+li .25em)
    'list.indent': '2em',
    'li.spacing': '.25em',
    // 引用(0 1em / .25em solid #d1d9e0 / #59636e)
    'quote.borderWidth': '.25em',
    'quote.borderColor': '#d1d9e0',
    'quote.color': '#59636e',
    'quote.padding': '0 1em',
    // 表格(单元格四边全网格 #d1d9e0;斑马纹 #f6f8fa;表头无底色仅 600;cell 6px 13px)
    'table.borderColor': '#d1d9e0',
    'cell.border': '1px solid #d1d9e0',
    'table.stripeBg': '#f6f8fa',
    'th.weight': '600',
    'cell.padding': '6px 13px',
    // hr(height .25em,bg #d1d9e0)
    'hr.color': '#d1d9e0',
    'hr.thickness': '.25em',
    // 图片无圆角/边框(源无)
    'img.radius': '0',
  } satisfies ThemeTokens,
  /** dark 面 = github-markdown-css dark:整体替换 light 面,需带全部存续键 */
  dark: {
    'root.font':
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    'root.size': '16px',
    'root.leading': '1.5',
    'root.color': '#f0f6fc',
    'root.bg': '#0d1117',
    'root.width': '64rem',
    'p.marginBottom': '10px',
    'heading.weight': '600',
    'heading.leading': '1.25',
    'heading.marginTop': '1.5rem',
    'heading.marginBottom': '1rem',
    'h1.size': '2em',
    'h1.borderWidth': '1px',
    'h1.borderColor': '#3d444db3',
    'h1.paddingBottom': '.3em',
    'h2.size': '1.5em',
    'h2.borderWidth': '1px',
    'h2.borderColor': '#3d444db3',
    'h2.paddingBottom': '.3em',
    'h3.size': '1.25em',
    'h4.size': '1em',
    'h5.size': '.875em',
    'h6.size': '.85em',
    'h6.color': '#9198a1',
    'a.color': '#4493f8',
    'a.underline': 'always',
    'strong.weight': '600',
    'inlineCode.font':
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    'inlineCode.size': '85%',
    'inlineCode.bg': '#656c7633',
    'inlineCode.padding': '.2em .4em',
    'inlineCode.radius': '6px',
    'codeBlock.font':
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    'codeBlock.size': '85%',
    'codeBlock.leading': '1.45',
    'codeBlock.padding': '1rem',
    'codeBlock.radius': '6px',
    'codeBlock.bg': '#151b23',
    'list.indent': '2em',
    'li.spacing': '.25em',
    'quote.borderWidth': '.25em',
    'quote.borderColor': '#3d444d',
    'quote.color': '#9198a1',
    'quote.padding': '0 1em',
    'table.borderColor': '#3d444d',
    'cell.border': '1px solid #3d444d',
    'table.stripeBg': '#151b23',
    'th.weight': '600',
    'cell.padding': '6px 13px',
    'hr.color': '#3d444d',
    'hr.thickness': '.25em',
    'img.radius': '0',
  } satisfies ThemeTokens,
}

export const BUILTIN_THEMES: ThemeFile[] = [MINIMAL, GITHUB]
