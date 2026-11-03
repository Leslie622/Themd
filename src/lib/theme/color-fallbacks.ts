import type { TokenKey } from './tokens'
import { isFontAvailable } from '@/components/settings/is-font-available'

/**
 * 回落色预览（P5 打磨）：颜色令牌未设置时,元素实际呈现「继承/回落」后的颜色。
 * 从右栏「元素效果」迷你预览的实时 DOM 上测量,让色块显示真实观感而非棋盘格。
 * 映射:颜色令牌 → 迷你预览里的目标元素 + CSS 属性。
 */
const COLOR_FALLBACK_TARGETS: Partial<Record<TokenKey, { selector: string; prop: string }>> = {
  'root.color': { selector: ':scope', prop: 'color' },
  // 共用标题令牌从正文根实测:未设置时标题 inherit 正文色;
  // 若测 h1,计算值会被 h1.color 等各级覆盖污染(共用的回落 ≠ 某一级的实际值)
  'heading.color': { selector: ':scope', prop: 'color' },
  'h1.color': { selector: 'h1', prop: 'color' },
  'h2.color': { selector: 'h2', prop: 'color' },
  'h3.color': { selector: 'h3', prop: 'color' },
  'h4.color': { selector: 'h4', prop: 'color' },
  'h5.color': { selector: 'h5', prop: 'color' },
  'h6.color': { selector: 'h6', prop: 'color' },
  'strong.color': { selector: 'strong', prop: 'color' },
  'strong.bg': { selector: 'strong', prop: 'backgroundColor' },
  'em.color': { selector: 'em', prop: 'color' },
  'em.bg': { selector: 'em', prop: 'backgroundColor' },
  // TipTap Strike 渲染 <s>,静态预览 <del>:选择器两者通吃
  'del.color': { selector: 'del, s', prop: 'color' },
  'del.textColor': { selector: 'del, s', prop: 'textDecorationColor' },
  'del.bg': { selector: 'del, s', prop: 'backgroundColor' },
  'a.color': { selector: 'a', prop: 'color' },
  // 悬停色未设置时回落常态链接色(不变色),测常态值即可
  'a.hoverColor': { selector: 'a', prop: 'color' },
  'a.hoverLineColor': { selector: 'a', prop: 'textDecorationColor' },
  'a.underlineColor': { selector: 'a', prop: 'textDecorationColor' },
  'a.bg': { selector: 'a', prop: 'backgroundColor' },
  'inlineCode.color': { selector: ':scope p code, :scope li code', prop: 'color' },
  'inlineCode.bg': { selector: ':scope p code, :scope li code', prop: 'backgroundColor' },
  'inlineCode.borderColor': { selector: ':scope p code, :scope li code', prop: 'borderColor' },
  'quote.color': { selector: 'blockquote', prop: 'color' },
  'quote.bg': { selector: 'blockquote', prop: 'backgroundColor' },
  'quote.borderColor': { selector: 'blockquote', prop: 'borderLeftColor' },
  // 提示块强调色:从未设置时的标题行实测(回落色 = 基础样式表的五色)
  'callout.note': { selector: '.themd-callout-note .themd-callout-title', prop: 'color' },
  'callout.tip': { selector: '.themd-callout-tip .themd-callout-title', prop: 'color' },
  'callout.important': { selector: '.themd-callout-important .themd-callout-title', prop: 'color' },
  'callout.warning': { selector: '.themd-callout-warning .themd-callout-title', prop: 'color' },
  'callout.caution': { selector: '.themd-callout-caution .themd-callout-title', prop: 'color' },
  'ul.markerColor': { selector: 'ul li', prop: 'color' },
  // 二/三级圆点色未设时链式回落到一级(最终 currentColor=所在 li 文字色),测对应层级 li
  'ul.markerColor2': { selector: 'ul ul li', prop: 'color' },
  'ul.markerColor3': { selector: 'ul ul ul li', prop: 'color' },
  'li.color': { selector: 'li', prop: 'color' },
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

/** 字体令牌 → 预览里的目标元素(回落字体从哪个元素实测)。
 *  共用 heading.font 同理从正文根实测:未设置时标题 inherit 正文字体,
 *  测 h1 会被 h1.font 等各级设置污染。 */
const FONT_FALLBACK_TARGETS: Partial<Record<TokenKey, string>> = {
  'root.fontLatin': ':scope',
  'heading.fontLatin': ':scope',
  'h1.fontLatin': 'h1',
  'h2.fontLatin': 'h2',
  'h3.fontLatin': 'h3',
  'h4.fontLatin': 'h4',
  'h5.fontLatin': 'h5',
  'h6.fontLatin': 'h6',
  'inlineCode.fontLatin': ':scope p code, :scope li code',
  // 字体声明在 pre code 上(pre 本体被 Tailwind preflight 的 --font-mono 接管,
  // 测 pre 会得到错误的回显),必须测真正携带字体的元素
  'codeBlock.fontLatin': 'pre code',
  // strong/em/del/a 是行内元素,选正文段落里的对应标记测;样文里没有时测不到,不回显
  'strong.fontLatin': ':scope p strong, :scope li strong',
  'em.fontLatin': ':scope p em, :scope li em',
  'del.fontLatin': ':scope p del, :scope li del, :scope p s, :scope li s, :scope del, :scope s',
  'a.fontLatin': ':scope a',
}

/** 中文字体令牌与西文端共用同一实测元素(cjk 回显从合并栈里找覆盖汉字的族) */
const CJK_TARGET_SOURCES: Partial<Record<TokenKey, TokenKey>> = {
  'root.fontCjk': 'root.fontLatin',
  'heading.fontCjk': 'heading.fontLatin',
  'h1.fontCjk': 'h1.fontLatin',
  'h2.fontCjk': 'h2.fontLatin',
  'h3.fontCjk': 'h3.fontLatin',
  'h4.fontCjk': 'h4.fontLatin',
  'h5.fontCjk': 'h5.fontLatin',
  'h6.fontCjk': 'h6.fontLatin',
  'inlineCode.fontCjk': 'inlineCode.fontLatin',
  'codeBlock.fontCjk': 'codeBlock.fontLatin',
  'strong.fontCjk': 'strong.fontLatin',
  'em.fontCjk': 'em.fontLatin',
  'del.fontCjk': 'del.fontLatin',
  'a.fontCjk': 'a.fontLatin',
}

/** 判断一个 font-family 族是否覆盖汉字:非拉丁限定族视为中文族。
 *  通用族不算覆盖——回显要穿透它报出真实渲染的汉字族(Windows 上
 *  system-ui 实际落到 Microsoft YaHei 画汉字),报 system-ui 没有信息量。 */
function coversCjk(family: string): boolean {
  if (/^(system-ui|sans-serif|serif|inherit|monospace)$/i.test(family)) return false
  // 非纯 ASCII 名(中文族名)或明确带中文语义的族算覆盖
  return !/^[a-z0-9 _-]+$/i.test(family) || /cjk|hei|song|kai|yahei|pingfang|harmony/i.test(family)
}

/**
 * 在预览根元素上测量一组字体令牌的回落字体:computed font-family 的
 * 第一个族名(去引号)。未设置时标题继承正文、正文回落基础样式表,
 * 测出来的就是「实际生效」的那个字体。找不到目标元素/族名的项不出现在结果里。
 * cjk 令牌:从同一元素的合并栈里找第一个覆盖汉字的族(中文族排在栈后段,
 * 取第一族永远拿到西文)。
 */
export function resolveFallbackFonts(
  previewRoot: HTMLElement,
  keys: TokenKey[],
): Partial<Record<TokenKey, string>> {
  const result: Partial<Record<TokenKey, string>> = {}
  for (const key of keys) {
    const cjkSource = CJK_TARGET_SOURCES[key as TokenKey]
    const lookup = cjkSource ?? key
    const selector = FONT_FALLBACK_TARGETS[lookup]
    if (!selector) continue
    const el = selector === ':scope' ? previewRoot : previewRoot.querySelector(selector)
    if (!el) continue
    const families = getComputedStyle(el)
      .fontFamily.split(',')
      .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    if (cjkSource) {
      // 报第一个「覆盖汉字且真实安装」的族:仅覆盖判定会命中未安装的 macOS 族
      // (如 Windows 栈里的 PingFang SC),回显必须与实际渲染一致
      const cjkFamily = families.find((f) => coversCjk(f) && isFontAvailable(f))
      // 栈里全是通用族(如极简默认 system-ui,sans-serif)时没有具体汉字族可报,
      // 穿透通用族报操作系统的中文默认(按平台;浏览器端同为这两大平台)
      if (cjkFamily) result[key] = cjkFamily
      else result[key] = isFontAvailable('PingFang SC') ? 'PingFang SC' : 'Microsoft YaHei'
      continue
    }
    // 西文端:第一族是通用族(system-ui 等)时穿透报真实渲染族
    // (Windows 上 system-ui = Segoe UI);具体族照实报
    const first = families[0]
    if (!first) continue
    result[key] = /^(system-ui|sans-serif|serif|inherit)$/i.test(first)
      ? (isFontAvailable('Segoe UI') ? 'Segoe UI' : first)
      : first
  }
  return result
}
