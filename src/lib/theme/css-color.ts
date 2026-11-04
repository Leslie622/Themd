/**
 * CSS 颜色串 → sRGB rgba 解析(取色器回流/种子用)。
 * 项目默认色板大量使用 oklch(),而取色器是 sRGB(HSV)面板——要让面板指针
 * 落在真实色上,必须先转成 rgb。两层实现:
 * - oklchToRgba:纯数学转换(Ottosson oklab 常数),精确、可测试、无 DOM;
 *   超出色域的分量靠最终 clamp 收进 sRGB(取色器面板本身就是 sRGB,够用)
 * - cssColorToRgba:其余浏览器认识而正则层不认识的格式(named/color()/
 *   百分号 rgb/grad 色相角等)走 canvas 兜底,由浏览器原生转换;
 *   无 DOM 环境(happy-dom/Node)返回 null
 * 参考真值(Chromium canvas getImageData 实测):oklch(0.9 0 0)→222 灰、
 * oklch(0.55 0.16 255)→rgb(33,113,204) 等,单测以此锚定。
 */

export interface RgbaColor {
  r: number
  g: number
  b: number
  /** 0–1 */
  a: number
}

/** oklch() 串 → rgba。支持 number/百分比、none 分量、deg 色相角、斜线 alpha;
 *  非 oklch 串或分量非法返回 null(grad/rad 等罕见角单位不硬解,交给 canvas 层) */
export function oklchToRgba(v: string): RgbaColor | null {
  const m = v.trim().match(/^oklch\(([^)]+)\)$/i)
  if (!m) return null
  // 斜线两侧可能无空格(oklch(0.5 0.1 30/0.5)),统一补空格再切
  const tokens = m[1].replace(/\//g, ' / ').split(/\s+/).filter(Boolean)
  const slash = tokens.indexOf('/')
  // 无斜线必须恰好 3 个分量;有斜线必须「3 分量 + / + alpha」——
  // 多余 token(grad/turn 等角单位、残缺串)一律不硬解,交 canvas 层兜底
  if (slash === -1 ? tokens.length !== 3 : tokens.length !== slash + 2) return null
  const comps = slash === -1 ? tokens : tokens.slice(0, slash)
  const l = parseComponent(comps[0], 1)
  const c = parseComponent(comps[1], 0.4)
  const hRaw = comps[2].replace(/deg$/i, '')
  const h = hRaw === 'none' ? 0 : Number(hRaw)
  const a = parseAlpha(slash === -1 ? undefined : tokens[slash + 1])
  if (l === null || c === null || !Number.isFinite(h) || !Number.isFinite(a)) return null
  return { ...oklchChannelsToRgb(l, c, h), a: Math.min(1, Math.max(0, a)) }
}

/** 分量解析:none=0;百分比 = n/100 × percentRef(亮度满值 1、色度满值 0.4,见 CSS Color 4) */
function parseComponent(raw: string, percentRef: number): number | null {
  if (raw === 'none') return 0
  if (raw.endsWith('%')) return (Number(raw.slice(0, -1)) / 100) * percentRef
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** alpha 解析:缺省 1;none 按 CSS 规则视为 0;支持百分比 */
function parseAlpha(raw: string | undefined): number {
  if (raw === undefined) return 1
  if (raw === 'none') return 0
  return raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw)
}

/** Ottosson oklab → 线性 sRGB 矩阵常数(bjornsson 官方发布值),最终 gamma 编码 */
function oklchChannelsToRgb(l: number, c: number, hDeg: number): { r: number; g: number; b: number } {
  const a = c * Math.cos((hDeg * Math.PI) / 180)
  const b = c * Math.sin((hDeg * Math.PI) / 180)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const L = l_ * l_ * l_
  const M = m_ * m_ * m_
  const S = s_ * s_ * s_
  const lin = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
  const [r, g, b2] = lin.map(gammaEncode)
  return { r, g, b: b2 }
}

/** sRGB gamma 编码 + 收进 0–255(负值/超色域统一 clamp) */
function gammaEncode(x: number): number {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}

const CANVAS_SENTINEL = '#010203'
/** 模块级单例 1×1 画布(lazy);undefined=未初始化,null=环境无 2d 上下文 */
let canvasCtx: CanvasRenderingContext2D | null | undefined

/**
 * 任意 CSS 颜色串 → rgba(canvas 兜底层):fillStyle 哨兵校验合法性,
 * getImageData 读像素。宽色域(color(display-p3))会被画布收进 sRGB——
 * 取色器面板是 sRGB,正是所需行为。
 */
export function cssColorToRgba(v: string): RgbaColor | null {
  // 哨兵假阴性:字面值恰为 #010203(及等值写法)解析后串不变,会误判非法;
  // hex/rgb() 等值形式在调用方正则层已提前消化,这里再兜一道底
  if (/^#010203$/i.test(v.trim())) return { r: 1, g: 2, b: 3, a: 1 }
  if (canvasCtx === undefined) {
    try {
      canvasCtx = document.createElement('canvas').getContext('2d')
    } catch {
      canvasCtx = null
    }
    if (canvasCtx) canvasCtx.canvas.width = canvasCtx.canvas.height = 1
  }
  if (!canvasCtx) return null
  const ctx = canvasCtx
  ctx.fillStyle = CANVAS_SENTINEL
  ctx.fillStyle = v
  if (ctx.fillStyle === CANVAS_SENTINEL) return null // 解析失败保持哨兵原值 → 非法
  // 单例画布防上次绘制残留:半透明色叠加旧像素会污染读数
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
}
