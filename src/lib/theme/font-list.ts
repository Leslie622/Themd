/**
 * 系统字体枚举。
 * 浏览器无法直接列出全部已装字体;两条路径:
 * 1. Local Font Access API(queryLocalFonts)——完整列表,需用户授权,Chrome/Edge 支持
 * 2. 测量法——用一段预置的常见字体名单逐一探测是否安装(离线可用、全浏览器兼容)
 * 两者合并去重:测量法结果立即可用,授权后补全完整列表。
 */

/** 测量法候选名单:常见的 Windows / macOS / Linux 字体 + 若干中文字体 */
const PROBE_FONTS = [
  // 中文
  '微软雅黑', 'Microsoft YaHei', '苹方', 'PingFang SC', '宋体', 'SimSun',
  '新宋体', 'NSimSun', '黑体', 'SimHei', '楷体', 'KaiTi', '仿宋', 'FangSong',
  '幼圆', 'YouYuan', '华文黑体', 'STHeiti', '华文楷体', 'STKaiti',
  '思源黑体', 'Source Han Sans SC', '思源宋体', 'Source Han Serif SC',
  'Noto Sans SC', 'Noto Serif SC',
  // 西文经典
  'Arial', 'Helvetica', 'Helvetica Neue', 'Segoe UI', 'Tahoma', 'Verdana',
  'Trebuchet MS', 'Times New Roman', 'Georgia', 'Garamond', 'Palatino',
  'Cambria', 'Calibri', 'Candara', 'Corbel', 'Constantia', 'Impact',
  'Comic Sans MS', 'Courier New', 'Consolas', 'Cascadia Code', 'Cascadia Mono',
  'Menlo', 'Monaco', 'SF Pro Text', 'Optima', 'Futura', 'Gill Sans',
  'Baskerville', 'Didot', 'Avenir', 'Avenir Next', 'Roboto', 'Ubuntu',
  'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans',
  // 编程字体
  'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'IBM Plex Mono',
  'Inconsolata', 'Hack', 'Victor Mono', 'Cascadia Code PL',
]

/** 基准字体:探测时用作对照(字体不存在时浏览器回退到它们,宽度不同即存在) */
const BASE_FONTS = ['monospace', 'serif', 'sans-serif']

let cachedProbe: string[] | null = null

/** 测量法:逐个探测候选字体是否已安装。结果缓存(字体安装变化需重启页面才刷新) */
export function detectInstalledFonts(): string[] {
  if (cachedProbe) return cachedProbe
  if (typeof document === 'undefined') return []
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const text = 'mmmwwwwiiiilll字国和的 0123'
  const baseWidths = BASE_FONTS.map((f) => {
    ctx.font = `72px ${f}`
    return ctx.measureText(text).width
  })

  const installed: string[] = []
  for (const font of PROBE_FONTS) {
    ctx.font = `72px "${font}", monospace`
    const w1 = ctx.measureText(text).width
    ctx.font = `72px "${font}", serif`
    const w2 = ctx.measureText(text).width
    // 与两种基准都不同 => 该字体真实存在并参与渲染
    const idx = BASE_FONTS.indexOf('monospace')
    const serifIdx = BASE_FONTS.indexOf('serif')
    if (w1 !== baseWidths[idx] || w2 !== baseWidths[serifIdx]) {
      installed.push(font)
    }
  }
  cachedProbe = installed
  return installed
}

/** 授权完整枚举(Local Font Access)。支持并授权 → 完整列表;不支持/拒绝 → null */
export async function requestAllFonts(): Promise<string[] | null> {
  const api = (
    window as unknown as {
      queryLocalFonts?: () => Promise<Array<{ family: string }>>
    }
  ).queryLocalFonts
  if (!api) return null
  try {
    const fonts = await api()
    const families = [...new Set(fonts.map((f) => f.family))]
    families.sort((a, b) => a.localeCompare(b))
    // 完整列表缓存进 localStorage,后续会话免重复扫描
    try {
      localStorage.setItem('themd-font-families', JSON.stringify(families))
    } catch {
      // 配额异常不影响主流程
    }
    return families
  } catch {
    return null // 用户拒绝授权
  }
}

/** 上次授权拿到的完整列表(免重复授权) */
export function getCachedFullFontList(): string[] | null {
  try {
    const raw = localStorage.getItem('themd-font-families')
    if (!raw) return null
    const list = JSON.parse(raw) as unknown
    return Array.isArray(list) && list.length > 0 ? (list as string[]) : null
  } catch {
    return null
  }
}

/** Local Font Access 是否可用(决定 UI 是否显示「获取完整列表」入口) */
export function isLocalFontAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'queryLocalFonts' in window
}
