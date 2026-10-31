/**
 * 系统字体枚举(桌面端):IPC 调 Rust 侧枚举系统字体注册表,精确全量、
 * 无权限弹窗。canvas 测量法仅作首帧的快速近似(IPC 返回前先显示常见字体),
 * localStorage 缓存上次完整列表供下次会话秒显。
 */

/** 桌面端:Rust 枚举的完整字体族列表(带会话内缓存) */
let desktopFontsCache: string[] | null = null
async function desktopFontList(): Promise<string[]> {
  if (desktopFontsCache) return desktopFontsCache
  const { invoke } = await import('@/platform/tauri/commands')
  const families = await invoke<string[]>('list_system_fonts')
  desktopFontsCache = families
  return families
}

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

/** requestAllFonts 的结果:ok 带列表;其余带原因(UI 据此提示) */
export type FontAccessResult =
  | { ok: true; fonts: string[] }
  | { ok: false; reason: 'unsupported' | 'denied' | 'error' }

/** 完整枚举:Rust IPC,无权限概念。失败(如命令异常)返回 error 原因 */
export async function requestAllFonts(): Promise<FontAccessResult> {
  try {
    const fonts = await desktopFontList()
    // 完整列表缓存进 localStorage,后续会话免重复 IPC,首帧即可显示
    try {
      localStorage.setItem('themd-font-families', JSON.stringify(fonts))
    } catch {
      // 配额异常不影响主流程
    }
    return { ok: true, fonts }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** 上次的完整列表缓存(会话开始时先显示,免等 IPC) */
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

/** 完整列表是否可获取(桌面端 IPC 恒可用;保留函数让 UI 逻辑不动) */
export function isLocalFontAccessSupported(): boolean {
  return true
}
