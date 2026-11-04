/** canvas 墨迹检测:字体族是否在本机可用(与回退字体测宽比对,不同即存在)。
 * 每次检测用独立 canvas——复用同一 ctx 时字体解析结果会被缓存污染,
 * 已安装的字体也会被误判为未安装(实测 Microsoft YaHei 误报) */
const glyphCheckCache = new Map<string, boolean>()

/** 纯测量(不走缓存):独立 canvas 防 ctx 字体解析缓存污染 */
function measureAvailable(name: string): boolean {
  const probe = (font: string) => {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return NaN
    ctx.font = `48px ${font}`
    return ctx.measureText('笔记 ABC abc 012 {,}').width
  }
  return (
    probe(`"${name}", monospace`) !== probe('monospace') ||
    probe(`"${name}", serif`) !== probe('serif')
  )
}

export function isFontAvailable(family: string): boolean {
  const name = family.trim().replace(/^['"]|['"]$/g, '')
  if (!name) return true
  const cached = glyphCheckCache.get(name)
  if (cached !== undefined) return cached
  const available = measureAvailable(name)
  glyphCheckCache.set(name, available)
  return available
}

/** 判定翻转的订阅:复测纠正缓存后通知 UI 重渲染 */
const changeListeners = new Set<() => void>()

export function onFontAvailabilityChange(cb: () => void): () => void {
  changeListeners.add(cb)
  return () => {
    changeListeners.delete(cb)
  }
}

/**
 * 打包字体(@font-face)的二次复测:canvas measureText 不触发 webfont 加载,
 * 首帧同步判定时包内字体尚未就绪 → 打包字体(本机未装)被误判未安装且永久缓存。
 * 用 FontFaceSet.load 显式触发加载后按原测量法复测,判定翻转即广播;
 * 系统字体首测即准确,不在复测名单;load 对无 @font-face 的族名静默空转。
 */
export async function recheckFontAvailability(): Promise<boolean> {
  if (typeof document === 'undefined' || !('fonts' in document)) return false
  const pending = [...glyphCheckCache.entries()].filter(([, v]) => !v).map(([k]) => k)
  if (pending.length === 0) return false
  await Promise.all(pending.map((name) => document.fonts.load(`48px "${name}"`).catch(() => [])))
  let changed = false
  for (const name of pending) {
    const verdict = measureAvailable(name)
    if (verdict !== glyphCheckCache.get(name)) {
      glyphCheckCache.set(name, verdict)
      changed = true
    }
  }
  if (changed) changeListeners.forEach((cb) => cb())
  return changed
}
