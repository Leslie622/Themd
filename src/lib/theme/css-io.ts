import type { ThemeFile } from './schema'
import { TOKEN_VAR, type ThemeTokens, type TokenKey } from './tokens'

/**
 * CSS 导入导出（P3）。
 * 导出：令牌解析为完整 .css 文本（选择器可切换 Typora 兼容的 #write）。
 * 导入：浏览器原生 CSSStyleSheet 解析规则 → 能映射的转为令牌，
 *       映射不了的（伪元素/复杂选择器）收进主题 extraCss 并做作用域包装。
 */

export type CssScope = '.themd-prose' | '#write'

/** 导出：令牌 → 完整 .css 文本。样式值直接来自令牌（差异集），未设置的项不输出。 */
export function exportThemeCss(theme: ThemeFile, scope: CssScope = '.themd-prose'): string {
  const lines: string[] = [
    `/* ${theme.name} — 由 Themd 主题工场导出 */`,
    `/* 选择器作用域：${scope}（Typora 主题请用 #write 版本） */`,
    '',
  ]
  const body: string[] = []
  for (const [key, varName] of Object.entries(TOKEN_VAR)) {
    const value = theme.tokens[key as TokenKey]
    if (value !== undefined && value !== '') {
      body.push(`  ${cssPropFor(key as TokenKey)}: ${value}; /* ${varName} */`)
    }
  }
  // a.underline 策略展开
  const underline = theme.tokens['a.underline']
  if (underline === 'always') {
    body.push('  text-decoration-line: underline;')
    body.push('  & a:hover { text-decoration-line: underline; }')
  } else if (underline === 'hover') {
    body.push('  text-decoration-line: none;')
    body.push('  & a:hover { text-decoration-line: underline; }')
  } else if (underline === 'none') {
    body.push('  text-decoration-line: none;')
  }
  lines.push(`${scope} {`)
  lines.push(...body)
  lines.push('}')
  if (theme.extraCss?.trim()) {
    lines.push('', '/* ── 附加自定义 CSS ── */', theme.extraCss)
  }
  return lines.join('\n')
}

/** 令牌键 → CSS 属性名（与 theme-base.css 消费端一致） */
function cssPropFor(key: TokenKey): string {
  const map: Partial<Record<TokenKey, string>> = {
    'root.font': 'font-family',
    'root.size': 'font-size',
    'root.leading': 'line-height',
    'root.color': 'color',
    'root.bg': 'background',
    'root.width': 'max-width',
    'root.spacing': 'letter-spacing',
    'p.marginBottom': 'margin-bottom',
    'p.align': 'text-align',
    'p.indent': 'text-indent',
    'heading.font': 'font-family',
    'heading.color': 'color',
    'heading.weight': 'font-weight',
    'heading.leading': 'line-height',
    'heading.marginTop': 'margin-top',
    'heading.marginBottom': 'margin-bottom',
    'h1.size': 'font-size', 'h2.size': 'font-size', 'h3.size': 'font-size',
    'h4.size': 'font-size', 'h5.size': 'font-size', 'h6.size': 'font-size',
    'h1.color': 'color', 'h2.color': 'color', 'h3.color': 'color',
    'h4.color': 'color', 'h5.color': 'color', 'h6.color': 'color',
    'h1.borderWidth': 'border-bottom-width', 'h2.borderWidth': 'border-bottom-width',
    'h1.borderColor': 'border-bottom-color', 'h2.borderColor': 'border-bottom-color',
    'h1.paddingBottom': 'padding-bottom', 'h2.paddingBottom': 'padding-bottom',
    'strong.weight': 'font-weight',
    'strong.color': 'color',
    'strong.bg': 'background',
    'strong.padding': 'padding',
    'em.style': 'font-style',
    'em.color': 'color',
    'del.color': 'color',
    'del.textColor': 'text-decoration-color',
    'a.color': 'color',
    'inlineCode.font': 'font-family',
    'inlineCode.size': 'font-size',
    'inlineCode.color': 'color',
    'inlineCode.bg': 'background',
    'inlineCode.padding': 'padding',
    'inlineCode.radius': 'border-radius',
    'inlineCode.borderWidth': 'border-width',
    'inlineCode.borderColor': 'border-color',
    'codeBlock.font': 'font-family',
    'codeBlock.bg': 'background',
    'codeBlock.size': 'font-size',
    'codeBlock.leading': 'line-height',
    'codeBlock.padding': 'padding',
    'codeBlock.radius': 'border-radius',
    'codeBlock.borderWidth': 'border-width',
    'codeBlock.borderColor': 'border-color',
    'list.indent': 'padding-left',
    'li.spacing': 'margin-top',
    'ul.markerColor': 'color',
    'ol.markerColor': 'color',
    'task.accent': 'accent-color',
    'quote.borderWidth': 'border-left-width',
    'quote.borderColor': 'border-left-color',
    'quote.bg': 'background',
    'quote.color': 'color',
    'quote.radius': 'border-radius',
    'quote.padding': 'padding',
    'quote.style': 'font-style',
    'table.borderColor': 'border-color',
    'table.stripeBg': 'background',
    'th.bg': 'background',
    'th.weight': 'font-weight',
    'cell.padding': 'padding',
    'hr.color': 'background',
    'hr.thickness': 'height',
    'img.maxWidth': 'max-width',
    'img.radius': 'border-radius',
    'img.borderWidth': 'border-width',
    'img.borderColor': 'border-color',
    'img.shadow': 'box-shadow',
  }
  return map[key] ?? key.split('.')[1].replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

// ============================================================
// 导入：CSS → 令牌 + extraCss
// ============================================================

/** 每类元素的候选选择器（末段匹配，忽略复合层级）。按优先级排列。 */
const SELECTOR_MAP: { keys: TokenKey[]; test: RegExp }[] = [
  // 元素级规则（.themd-prose strong / #write strong / body strong …）
  { keys: ['strong.weight', 'strong.color', 'strong.bg'], test: /(^|[\s,#.>])strong$/ },
  { keys: ['em.style', 'em.color'], test: /(^|[\s,#.>])em$/i },
  { keys: ['del.color', 'del.textColor'], test: /(^|[\s,#.>])(del|s)$/ },
  { keys: ['a.color'], test: /(^|[\s,#.>])a$/ },
  { keys: ['inlineCode.font'], test: /(^|[\s,#.>])code$/ },
  { keys: ['quote.borderColor'], test: /(^|[\s,#.>])blockquote$/ },
  { keys: ['codeBlock.bg'], test: /(^|[\s,#.>])pre$/ },
  { keys: ['ul.markerColor'], test: /(^|[\s,#.>])ul$/ },
  { keys: ['ol.markerColor'], test: /(^|[\s,#.>])ol$/ },
  { keys: ['list.indent'], test: /(^|[\s,#.>])(ul|ol)$/ },
  { keys: ['li.spacing'], test: /(^|[\s,#.>])li$/ },
  { keys: ['table.borderColor'], test: /(^|[\s,#.>])(table|th|td)$/ },
  { keys: ['th.bg', 'th.weight'], test: /(^|[\s,#.>])th$/ },
  { keys: ['cell.padding'], test: /(^|[\s,#.>])(th|td)$/ },
  { keys: ['hr.color', 'hr.thickness'], test: /(^|[\s,#.>])hr$/ },
  { keys: ['img.radius'], test: /(^|[\s,#.>])img$/ },
  // 根（body/#write/.markdown-body/.themd-prose 自身）
  { keys: ['root.font'], test: /^(body|html|#write|\.markdown-body|\.themd-prose|\.md-content)$/i },
]

/** 属性 → 令牌键 映射（元素内细分）。键为 '<元素>.*' 分组名，值为 CSS属性→令牌键。 */
const PROP_MAP: Record<string, Record<string, TokenKey>> = {
  'inlineCode.*': {
    'font-family': 'inlineCode.font', 'font-size': 'inlineCode.size',
    'color': 'inlineCode.color', 'background': 'inlineCode.bg', 'background-color': 'inlineCode.bg',
    'padding': 'inlineCode.padding', 'border-radius': 'inlineCode.radius',
  },
  'quote.*': {
    'border-left-width': 'quote.borderWidth', 'border-left': 'quote.borderColor',
    'border-left-color': 'quote.borderColor', 'border-color': 'quote.borderColor',
    'background': 'quote.bg', 'background-color': 'quote.bg',
    'color': 'quote.color', 'border-radius': 'quote.radius', 'padding': 'quote.padding',
    'font-style': 'quote.style',
  },
  'codeBlock.*': {
    'font-family': 'codeBlock.font', 'font-size': 'codeBlock.size',
    'line-height': 'codeBlock.leading', 'background': 'codeBlock.bg', 'background-color': 'codeBlock.bg',
    'padding': 'codeBlock.padding', 'border-radius': 'codeBlock.radius',
  },
  'img.*': {
    'max-width': 'img.maxWidth', 'border-radius': 'img.radius', 'box-shadow': 'img.shadow',
  },
  'root.*': {
    'font-family': 'root.font', 'font-size': 'root.size', 'line-height': 'root.leading',
    'color': 'root.color', 'background': 'root.bg', 'background-color': 'root.bg',
    'max-width': 'root.width', 'letter-spacing': 'root.spacing',
  },
}

export interface CssImportReport {
  /** 成功映射为令牌的声明数 */
  mapped: number
  /** 收进附加 CSS 的规则数 */
  extra: number
  /** 忽略的规则数（无法识别目标元素） */
  skipped: number
}

/**
 * 解析 CSS 文本 → 主题差异集。
 * 只接受「目标元素 + 简单属性」的规则；伪类/伪元素/复杂选择器进 extraCss（作用域包装在注入时做）。
 */
export function importThemeCss(
  cssText: string,
  target: { tokens: ThemeTokens; extraCss?: string },
): CssImportReport {
  const report: CssImportReport = { mapped: 0, extra: 0, skipped: 0 }
  const sheet = new CSSStyleSheet()
  let rules: CSSRuleList
  try {
    sheet.replaceSync(cssText)
    rules = sheet.cssRules
  } catch {
    // 完全解析失败：整段进 extraCss
    target.extraCss = appendExtra(target.extraCss, cssText)
    return { ...report, extra: 1 }
  }

  const extras: string[] = target.extraCss ? [target.extraCss] : []

  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      ingestStyleRule(rule, target, report, extras)
    } else if (rule instanceof CSSMediaRule) {
      for (const inner of Array.from(rule.cssRules)) {
        if (inner instanceof CSSStyleRule) {
          // 媒体查询里的规则不映射令牌（上下文不同），原样保留
          extras.push(rule.cssText)
          report.extra++
          break
        }
      }
    } else if (rule instanceof CSSFontFaceRule || rule instanceof CSSKeyframesRule) {
      extras.push(rule.cssText)
      report.extra++
    } else {
      report.skipped++
    }
  }
  if (extras.length) target.extraCss = extras.join('\n\n')
  return report
}

function ingestStyleRule(
  rule: CSSStyleRule,
  target: { tokens: ThemeTokens },
  report: CssImportReport,
  extras: string[],
) {
  const sel = rule.selectorText ?? ''
  // 归一化:去掉 #write/.themd-prose 等容器前缀后取「最后一段」判断目标元素
  const lastSeg = sel
    .split(/,/) // 多选择器逐段判断
    .map((s) => s.trim().split(/[\s>]+/).pop() ?? '')
    .map((s) => s.replace(/:{1,2}[a-z-]+$/i, '')) // 去尾部伪类/伪元素
    .find((s) => s.length > 0) ?? ''

  const entry = SELECTOR_MAP.find((m) => m.test.test(lastSeg))
  if (!entry || /:{1,2}/.test(sel)) {
    // 带伪类的选择器不映射（如 a:hover），收进附加 CSS
    if (/:{1,2}/.test(sel)) {
      // 容器前缀改写为 .themd-prose
      extras.push(rewriteScope(sel, rule.style.cssText))
      report.extra++
    } else {
      report.skipped++
    }
    return
  }

  const groupKey = entry.keys[0].split('.')[0]
  let mappedAny = false
  for (let i = 0; i < rule.style.length; i++) {
    const prop = rule.style.item(i)
    const value = rule.style.getPropertyValue(prop).trim()
    if (!value) continue
    const tokenKey = resolveTokenKey(groupKey, entry, prop)
    if (tokenKey && isValidValue(value)) {
      target.tokens[tokenKey] = value
      mappedAny = true
    }
  }
  if (mappedAny) report.mapped++
  else report.skipped++
}

/** 属性 → 具体令牌键 */
function resolveTokenKey(groupKey: string, entry: { keys: TokenKey[] }, prop: string): TokenKey | null {
  // 细分映射表优先（inlineCode.*/quote.*/codeBlock.*/img.*/root.*）
  const table = PROP_MAP[`${groupKey}.*`]
  if (table && prop in table) return table[prop] as TokenKey
  // 否则查 keys 里与属性名对应的键（strong/标题/表格等简单组）
  const norm = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
  for (const key of entry.keys) {
    const [, field] = key.split('.')
    if (field === norm) return key
  }
  // border-left / border-bottom 这类合并写法
  if (prop === 'border-left' && entry.keys.includes('quote.borderColor')) return 'quote.borderColor'
  if (prop === 'border-bottom' && entry.keys.includes('h1.borderColor')) {
    // border-bottom 简写只取颜色（宽度另算），交给调用方按需
    return null
  }
  return null
}

/** 值合法性：拒绝可能破坏布局/包含 url() 的注入风险值 */
function isValidValue(value: string): boolean {
  if (/(expression|javascript:|@import|url\()/i.test(value)) return false
  if (/[;{}]/.test(value)) return false
  return true
}

/** 附加 CSS 追加 */
function appendExtra(existing: string | undefined, css: string): string {
  return existing ? `${existing}\n\n${css}` : css
}

/** 选择器作用域改写：#write/.markdown-body → .themd-prose */
function rewriteScope(selector: string, body: string): string {
  const rewritten = selector
    .replace(/#write/g, '.themd-prose')
    .replace(/\.markdown-body/g, '.themd-prose')
    .replace(/(^|[\s,])body(?=[\s,.:#>]|$)/g, '$1.themd-prose')
  return `${rewritten} {\n  ${body.replace(/;\s*/g, ';\n  ')}\n}`
}

/** 导入 .css 后组装完整主题对象（工场调用） */
export function themeFromCssImport(
  name: string,
  cssText: string,
): { theme: ThemeFile; report: CssImportReport } {
  const theme: ThemeFile = {
    version: 1,
    id: crypto.randomUUID(),
    name,
    tokens: {},
  }
  const report = importThemeCss(cssText, theme)
  return { theme, report }
}
