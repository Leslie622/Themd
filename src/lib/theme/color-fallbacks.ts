import type { TokenKey } from './tokens'

/**
 * 回落色预览（P5 打磨）：颜色令牌未设置时,元素实际呈现「继承/回落」后的颜色。
 * 从右栏「元素效果」迷你预览的实时 DOM 上测量,让色块显示真实观感而非棋盘格。
 * 映射:颜色令牌 → 迷你预览里的目标元素 + CSS 属性。
 */
const COLOR_FALLBACK_TARGETS: Partial<Record<TokenKey, { selector: string; prop: string }>> = {
  'root.color': { selector: ':scope', prop: 'color' },
  'heading.color': { selector: 'h1', prop: 'color' },
  'h1.color': { selector: 'h1', prop: 'color' },
  'h2.color': { selector: 'h2', prop: 'color' },
  'h3.color': { selector: 'h3', prop: 'color' },
  'h4.color': { selector: 'h4', prop: 'color' },
  'h5.color': { selector: 'h5', prop: 'color' },
  'h6.color': { selector: 'h6', prop: 'color' },
  'strong.color': { selector: 'strong', prop: 'color' },
  'strong.bg': { selector: 'strong', prop: 'backgroundColor' },
  'em.color': { selector: 'em', prop: 'color' },
  'del.color': { selector: 'del', prop: 'color' },
  'del.textColor': { selector: 'del', prop: 'textDecorationColor' },
  'a.color': { selector: 'a', prop: 'color' },
  'inlineCode.color': { selector: ':scope p code, :scope li code', prop: 'color' },
  'inlineCode.bg': { selector: ':scope p code, :scope li code', prop: 'backgroundColor' },
  'inlineCode.borderColor': { selector: ':scope p code, :scope li code', prop: 'borderColor' },
  'quote.color': { selector: 'blockquote', prop: 'color' },
  'quote.bg': { selector: 'blockquote', prop: 'backgroundColor' },
  'quote.borderColor': { selector: 'blockquote', prop: 'borderLeftColor' },
  'ul.markerColor': { selector: 'ul li', prop: 'color' },
  'ol.markerColor': { selector: 'ol li', prop: 'color' },
  'task.accent': { selector: 'input.task-list-item-checkbox', prop: 'accentColor' },
  'table.borderColor': { selector: 'table', prop: 'borderColor' },
  'table.stripeBg': { selector: 'tbody tr:nth-child(2)', prop: 'backgroundColor' },
  'th.bg': { selector: 'thead th', prop: 'backgroundColor' },
  'codeBlock.bg': { selector: 'pre', prop: 'backgroundColor' },
  'codeBlock.borderColor': { selector: 'pre', prop: 'borderColor' },
  'hr.color': { selector: 'hr', prop: 'backgroundColor' },
  'img.borderColor': { selector: 'img', prop: 'borderColor' },
}

/** 透明/空值判定:返回 null 表示「无法给出有意义的回落色」 */
function normalizeColor(computed: string): string | null {
  const v = computed.trim()
  if (!v || v === 'transparent' || v === 'none') return null
  if (/^rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(v)) return null
  return v
}

/**
 * 在迷你预览根元素上测量一组颜色令牌的回落色。
 * 返回 { 令牌键 → 颜色值 } ,解析失败/透明的项不出现在结果里。
 */
export function resolveFallbackColors(
  previewRoot: HTMLElement,
  keys: TokenKey[],
): Partial<Record<TokenKey, string>> {
  const result: Partial<Record<TokenKey, string>> = {}
  const computedRoot = getComputedStyle(previewRoot)
  for (const key of keys) {
    const target = COLOR_FALLBACK_TARGETS[key]
    if (!target) continue
    let value: string | null = null
    if (target.selector === ':scope') {
      value = normalizeColor(computedRoot[target.prop as keyof CSSStyleDeclaration] as string)
    } else {
      const el = previewRoot.querySelector(target.selector)
      if (el) {
        value = normalizeColor(getComputedStyle(el)[target.prop as keyof CSSStyleDeclaration] as string)
      }
    }
    if (value) result[key] = value
  }
  return result
}
