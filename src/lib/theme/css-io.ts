import type { ThemeFile } from './schema'
import { type ThemeTokens, type TokenKey } from './tokens'

/**
 * CSS 导入（P3）。
 * 浏览器原生 CSSStyleSheet 解析规则 → 能映射的转为令牌，
 * 映射不了的（伪元素/复杂选择器）收进主题 extraCss 并做作用域包装。
 * CSS 导出走可移植样式包（portable-css.ts，令牌内联 + theme-base 全文），
 * 旧的 exportThemeCss 平铺翻译已于 2026-11-04 退役。
 */


// ============================================================
// 导入：CSS → 令牌 + extraCss
// ============================================================

/** 每类元素的候选选择器（末段匹配，忽略复合层级）。按优先级排列。 */
const SELECTOR_MAP: { keys: TokenKey[]; test: RegExp }[] = [
  // 元素级规则（.themd-prose strong / #write strong / body strong …）
  { keys: ['strong.fontLatin', 'strong.weight', 'strong.color', 'strong.bg', 'strong.padding', 'strong.margin'], test: /(^|[\s,#.>])strong$/ },
  { keys: ['em.fontLatin', 'em.weight', 'em.style', 'em.color', 'em.bg', 'em.padding', 'em.margin'], test: /(^|[\s,#.>])em$/i },
  { keys: ['del.fontLatin', 'del.weight', 'del.color', 'del.textColor', 'del.thickness', 'del.offset', 'del.bg', 'del.padding', 'del.margin'], test: /(^|[\s,#.>])(del|s)$/ },
  { keys: ['a.fontLatin', 'a.weight', 'a.color', 'a.hoverColor', 'a.underlineColor', 'a.underlineHeight', 'a.hoverLineColor', 'a.transition', 'a.bg', 'a.padding', 'a.margin'], test: /(^|[\s,#.>])a$/ },
  { keys: ['inlineCode.fontLatin', 'inlineCode.size', 'inlineCode.weight', 'inlineCode.color', 'inlineCode.bg', 'inlineCode.padding', 'inlineCode.margin', 'inlineCode.radius', 'inlineCode.borderWidth', 'inlineCode.borderColor'], test: /(^|[\s,#.>])code$/ },
  { keys: ['quote.borderColor'], test: /(^|[\s,#.>])blockquote$/ },
  { keys: ['codeBlock.bg'], test: /(^|[\s,#.>])pre$/ },
  { keys: ['ul.markerColor', 'ul.markerColor2', 'ul.markerColor3', 'ul.markerShape', 'ul.markerSize'], test: /(^|[\s,#.>])ul$/ },
  { keys: ['ol.markerColor', 'ol.markerSize'], test: /(^|[\s,#.>])ol$/ },
  { keys: ['list.indent', 'list.marginBottom', 'list.position'], test: /(^|[\s,#.>])(ul|ol)$/ },
  { keys: ['li.spacing', 'li.fontSize', 'li.leading', 'li.color'], test: /(^|[\s,#.>])li$/ },
  { keys: ['task.accent', 'task.size', 'task.radius', 'task.borderWidth', 'task.borderColor', 'task.doneColor', 'task.todoColor'], test: /(^|[\s,#.>])input$/i },
  { keys: ['task.doneColor', 'task.todoColor'], test: /(^|[\s,#.>])li\.task-list-item$/i },
  { keys: ['table.borderColor'], test: /(^|[\s,#.>])(table|th|td)$/ },
  { keys: ['th.bg', 'th.weight'], test: /(^|[\s,#.>])th$/ },
  { keys: ['cell.padding'], test: /(^|[\s,#.>])(th|td)$/ },
  { keys: ['hr.color', 'hr.thickness'], test: /(^|[\s,#.>])hr$/ },
  { keys: ['img.radius', 'img.margin'], test: /(^|[\s,#.>])img$/ },
  // 根（body/#write/.markdown-body/.themd-prose 自身）
  { keys: ['root.fontLatin'], test: /^(body|html|#write|\.markdown-body|\.themd-prose|\.md-content)$/i },
]

/** 属性 → 令牌键 映射（元素内细分）。键为 '<元素>.*' 分组名，值为 CSS属性→令牌键。 */
const PROP_MAP: Record<string, Record<string, TokenKey>> = {
  // 列表组:第三方 CSS 的 ul/ol/li 规则按语义代理回填
  // (ul 的 font-size 代理列表文字而非圆点,color 代理圆点色——与旧版行为一致)
  'list.*': {
    'padding-left': 'list.indent', 'margin-bottom': 'list.marginBottom',
    'list-style-position': 'list.position',
  },
  'ul.*': {
    'padding-left': 'list.indent', 'margin-bottom': 'list.marginBottom',
    'list-style-position': 'list.position', 'list-style-type': 'ul.markerShape',
    'color': 'ul.markerColor', 'font-size': 'li.fontSize',
  },
  'ol.*': {
    'padding-left': 'list.indent', 'margin-bottom': 'list.marginBottom',
    'list-style-position': 'list.position', 'list-style-type': 'ol.markerStyle',
    'color': 'ol.markerColor', 'font-size': 'ol.markerSize',
  },
  'li.*': {
    'margin-top': 'li.spacing', 'font-size': 'li.fontSize',
    'line-height': 'li.leading', 'color': 'li.color',
  },
  'input.*': {
    'accent-color': 'task.accent',
    'width': 'task.size', 'height': 'task.size',
    'border-radius': 'task.radius',
    'border-width': 'task.borderWidth', 'border': 'task.borderWidth',
    'border-color': 'task.borderColor',
  },
  'li.task-list-item.*': {
    'color': 'task.doneColor',
  },
  'inlineCode.*': {
    'font-family': 'inlineCode.fontLatin', 'font-size': 'inlineCode.size',
    'font-weight': 'inlineCode.weight',
    'color': 'inlineCode.color', 'background': 'inlineCode.bg', 'background-color': 'inlineCode.bg',
    'padding': 'inlineCode.padding', 'margin': 'inlineCode.margin', 'border-radius': 'inlineCode.radius',
  },
  'quote.*': {
    'border-left-width': 'quote.borderWidth', 'border-left': 'quote.borderColor',
    'border-left-color': 'quote.borderColor', 'border-color': 'quote.borderColor',
    'background': 'quote.bg', 'background-color': 'quote.bg',
    'color': 'quote.color', 'border-radius': 'quote.radius', 'padding': 'quote.padding',
    'font-style': 'quote.style',
  },
  'codeBlock.*': {
    'font-family': 'codeBlock.fontLatin', 'font-size': 'codeBlock.size',
    'line-height': 'codeBlock.leading', 'background': 'codeBlock.bg', 'background-color': 'codeBlock.bg',
    'padding': 'codeBlock.padding', 'border-radius': 'codeBlock.radius',
  },
  'img.*': {
    'max-width': 'img.maxWidth', 'border-radius': 'img.radius', 'box-shadow': 'img.shadow',
    'margin': 'img.margin', 'margin-block': 'img.margin',
  },
  'root.*': {
    'font-family': 'root.fontLatin', 'font-size': 'root.size', 'line-height': 'root.leading',
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
  // 嵌套深度规则(ul ul / ol ol 等):二级/三级圆点与编号的形状/样式/颜色。
  // lastSeg 归一化会丢失嵌套层级,必须在入口先识别;带伪元素的走 extraCss 分支
  const noPseudo = !/:{1,2}/.test(sel)
  const ulDepth = noPseudo ? nestedListDepth(sel, 'ul') : 0
  if (ulDepth === 2 || ulDepth === 3) {
    const table: Record<string, TokenKey> = ulDepth === 2
      ? { 'list-style-type': 'ul.markerShape2', 'color': 'ul.markerColor2' }
      : { 'list-style-type': 'ul.markerShape3', 'color': 'ul.markerColor3' }
    mapDepthRule(rule, table, target, report)
    return
  }
  const olDepth = noPseudo ? nestedListDepth(sel, 'ol') : 0
  if (olDepth === 2 || olDepth === 3) {
    const table: Record<string, TokenKey> = olDepth === 2
      ? { 'list-style-type': 'ol.markerStyle2' }
      : { 'list-style-type': 'ol.markerStyle3' }
    mapDepthRule(rule, table, target, report)
    return
  }
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

/** 嵌套深度规则按属性表回填令牌(ul/ol 深度分支共用) */
function mapDepthRule(
  rule: CSSStyleRule,
  table: Record<string, TokenKey>,
  target: { tokens: ThemeTokens },
  report: CssImportReport,
) {
  let mappedAny = false
  for (let i = 0; i < rule.style.length; i++) {
    const prop = rule.style.item(i)
    const value = rule.style.getPropertyValue(prop).trim()
    const tokenKey = table[prop]
    if (value && tokenKey && isValidValue(value)) {
      target.tokens[tokenKey] = value
      mappedAny = true
    }
  }
  if (mappedAny) report.mapped++
  else report.skipped++
}

/** 列表嵌套深度：选择器末段是纯 tag 后代链（如 `#write ul ul`）时返回层数,否则 0 */
function nestedListDepth(selector: string, tag: 'ul' | 'ol'): number {
  for (const part of selector.split(',')) {
    const rel = part
      .trim()
      .replace(/^(\.themd-prose|#write|\.markdown-body|\.md-content|body)\s*/i, '')
      .replace(/:{1,2}[a-z-]+$/i, '')
    const re = new RegExp(`(^|[\\s>])${tag}([\\s>]${tag})+$`, 'i')
    if (re.test(rel)) {
      return rel.split(/[\s>]+/).filter((s) => s.toLowerCase() === tag).length
    }
  }
  return 0
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
