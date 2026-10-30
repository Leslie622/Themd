/**
 * 系统字体枚举,按运行环境双轨:
 * - Tauri 桌面端:IPC 调 Rust 侧枚举系统字体注册表,精确全量、无权限弹窗
 * - 浏览器:queryLocalFonts(需授权)/ canvas 测量法(常见字体名单探测)
 */

/** 是否运行在 Tauri 桌面壳内 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

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

/** Local Font Access 权限状态;不支持该 API 时返回 null */
export async function localFontPermission(): Promise<
  'granted' | 'denied' | 'prompt' | null
> {
  try {
    const st = await navigator.permissions.query({ name: 'local-fonts' as PermissionName })
    return st.state as 'granted' | 'denied' | 'prompt'
  } catch {
    return null // 部分浏览器没有该权限描述符
  }
}

/** 授权完整枚举。桌面端走 IPC(无权限概念,直接成功);浏览器走 queryLocalFonts。
 * 新版 Chromium 在权限被拒后不再弹框,且 queryLocalFonts 直接回空数组,
 * 若不检查会被误当成成功、用空列表覆盖探测名单 */
export async function requestAllFonts(): Promise<FontAccessResult> {
  if (isTauri()) {
    try {
      const fonts = await desktopFontList()
      return { ok: true, fonts }
    } catch {
      return { ok: false, reason: 'error' }
    }
  }
  const api = (
    window as unknown as {
      queryLocalFonts?: () => Promise<Array<{ family: string }>>
    }
  ).queryLocalFonts
  if (!api) return { ok: false, reason: 'unsupported' }
  try {
    // 权限预检:denied 时把「回空数组」拦在覆盖数据之前
    const perm = await localFontPermission()
    if (perm === 'denied') return { ok: false, reason: 'denied' }
    const fonts = await api()
    if (fonts.length === 0) return { ok: false, reason: 'denied' } // 双保险
    const families = [...new Set(fonts.map((f) => f.family))]
    families.sort((a, b) => a.localeCompare(b))
    // 完整列表缓存进 localStorage,后续会话免重复扫描
    try {
      localStorage.setItem('themd-font-families', JSON.stringify(families))
    } catch {
      // 配额异常不影响主流程
    }
    return { ok: true, fonts: families }
  } catch {
    // NotAllowedError 等:用户当场拒绝或浏览器策略阻止
    return { ok: false, reason: 'denied' }
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

/** Local Font Access 是否可用(决定 UI 是否显示「获取完整列表」入口)。
 * 桌面端无权限门槛,始终视为可用 */
export function isLocalFontAccessSupported(): boolean {
  if (isTauri()) return true
  return typeof window !== 'undefined' && 'queryLocalFonts' in window
}
