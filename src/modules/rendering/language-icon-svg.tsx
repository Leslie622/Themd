import { renderToStaticMarkup } from 'react-dom/server'

import { LANGUAGE_ALIAS_TO_CANON } from './code-highlight'
import { LANGUAGE_ICONS } from './language-icon-data'

/**
 * 语言图标 SVG 序列化(共享层):simple-icons 官方图形 + 官方色值,
 * renderToStaticMarkup 出字节级稳定的纯 SVG 字符串。三方同源:
 * - 规范 HTML(static-html / md-it oracle):header 语言名前的彩色图标,
 *   随导出带到独立 HTML/PDF;
 * - 编辑面(codeblock-cm NodeView):innerHTML 同一字符串;
 * - 浮层列表(language-picker)走 language-icons.tsx 的 React 组件(同数据,
 *   图标数据单一来源在 language-icon-data.tsx)。
 * 缓存:每语言序列化一次(Map),规范 HTML 高频渲染零重复成本。
 */
const ICON_SIZE = 12
const svgCache = new Map<string, string | null>()

/**
 * fence 语言值 → 内联 SVG 字符串(official 图形+色);无品牌图返回 null,
 * 调用方跳过图标(纯文本标签)。序列化固定 size/色值,字节稳定。
 */
export function languageIconSvg(lang: string): string | null {
  const lower = lang.toLowerCase()
  const canon = LANGUAGE_ALIAS_TO_CANON[lower] ?? lower
  if (svgCache.has(canon)) return svgCache.get(canon) ?? null
  const def = LANGUAGE_ICONS[canon]
  if (!def) {
    svgCache.set(canon, null)
    return null
  }
  const svg = renderToStaticMarkup(
    <def.Icon size={ICON_SIZE} color={def.color} />,
  )
  svgCache.set(canon, svg)
  return svg
}
