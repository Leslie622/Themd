/**
 * 令牌键 → CSS 变量名的唯一契约。
 * 主题文件存令牌键，编译器产出 CSS 变量，theme-base.css 逐项消费——三方都以此文件为准。
 * 约定：键为 '<元素>.<属性>'（camelCase），变量为 --t-<元素>-<kebab 属性>。
 * 令牌只存差异：某键未设置 = 使用 theme-base.css 里的回落值 = 「极简」主题观感。
 */
export const TOKEN_VAR = {
  // 正文根
  'root.font': '--t-root-font',
  'root.size': '--t-root-size',
  'root.leading': '--t-root-leading',
  'root.color': '--t-root-color',
  'root.width': '--t-root-width',
  'root.spacing': '--t-root-spacing',
  'root.bg': '--t-root-bg',
  // 段落
  'p.marginBottom': '--t-p-margin-bottom',
  'p.align': '--t-p-align',
  'p.indent': '--t-p-indent',
  // 标题（各级共用）
  'heading.font': '--t-heading-font',
  'heading.color': '--t-heading-color',
  'heading.weight': '--t-heading-weight',
  'heading.leading': '--t-heading-leading',
  'heading.marginTop': '--t-heading-margin-top',
  'heading.marginBottom': '--t-heading-margin-bottom',
  // 各级标题
  'h1.size': '--t-h1-size',
  'h1.color': '--t-h1-color',
  'h1.borderWidth': '--t-h1-border-width',
  'h1.borderColor': '--t-h1-border-color',
  'h1.paddingBottom': '--t-h1-padding-bottom',
  'h2.size': '--t-h2-size',
  'h2.color': '--t-h2-color',
  'h2.borderWidth': '--t-h2-border-width',
  'h2.borderColor': '--t-h2-border-color',
  'h2.paddingBottom': '--t-h2-padding-bottom',
  'h3.size': '--t-h3-size',
  'h3.color': '--t-h3-color',
  'h4.size': '--t-h4-size',
  'h4.color': '--t-h4-color',
  'h5.size': '--t-h5-size',
  'h5.color': '--t-h5-color',
  'h6.size': '--t-h6-size',
  'h6.color': '--t-h6-color',
  // 行内元素
  'strong.weight': '--t-strong-weight',
  'strong.color': '--t-strong-color',
  'strong.bg': '--t-strong-bg',
  'strong.padding': '--t-strong-padding',
  'em.style': '--t-em-style',
  'em.color': '--t-em-color',
  'del.color': '--t-del-color',
  'del.textColor': '--t-del-text-color',
  'a.color': '--t-a-color',
  'a.underline': '--t-a-underline',
  // 行内代码
  'inlineCode.font': '--t-inline-code-font',
  'inlineCode.size': '--t-inline-code-size',
  'inlineCode.color': '--t-inline-code-color',
  'inlineCode.bg': '--t-inline-code-bg',
  'inlineCode.padding': '--t-inline-code-padding',
  'inlineCode.radius': '--t-inline-code-radius',
  'inlineCode.borderWidth': '--t-inline-code-border-width',
  'inlineCode.borderColor': '--t-inline-code-border-color',
  // 代码块
  'codeBlock.font': '--t-code-font',
  'codeBlock.bg': '--t-code-bg',
  'codeBlock.size': '--t-code-size',
  'codeBlock.leading': '--t-code-leading',
  'codeBlock.padding': '--t-code-padding',
  'codeBlock.radius': '--t-code-radius',
  'codeBlock.borderWidth': '--t-code-border-width',
  'codeBlock.borderColor': '--t-code-border-color',
  // 列表
  'list.indent': '--t-list-indent',
  'li.spacing': '--t-li-spacing',
  'ul.markerColor': '--t-ul-marker',
  'ol.markerColor': '--t-ol-marker',
  // 任务列表
  'task.accent': '--t-task-accent',
  // 引用
  'quote.borderWidth': '--t-quote-border-width',
  'quote.borderColor': '--t-quote-border-color',
  'quote.bg': '--t-quote-bg',
  'quote.color': '--t-quote-color',
  'quote.radius': '--t-quote-radius',
  'quote.padding': '--t-quote-padding',
  'quote.style': '--t-quote-style',
  // 表格
  'table.borderColor': '--t-table-border-color',
  'table.stripeBg': '--t-table-stripe',
  'th.bg': '--t-th-bg',
  'th.weight': '--t-th-weight',
  'cell.padding': '--t-cell-padding',
  // 分割线
  'hr.color': '--t-hr-color',
  'hr.thickness': '--t-hr-thickness',
  // 图片
  'img.maxWidth': '--t-img-max-width',
  'img.radius': '--t-img-radius',
  'img.borderWidth': '--t-img-border-width',
  'img.borderColor': '--t-img-border-color',
  'img.shadow': '--t-img-shadow',
} as const

export type TokenKey = keyof typeof TOKEN_VAR

/** 主题文件里的令牌集：稀疏，只存与默认不同的项 */
export type ThemeTokens = Partial<Record<TokenKey, string>>
