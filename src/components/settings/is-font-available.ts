/** canvas 墨迹检测:字体族是否在本机可用(与回退字体测宽比对,不同即存在)。
 * 每次检测用独立 canvas——复用同一 ctx 时字体解析结果会被缓存污染,
 * 已安装的字体也会被误判为未安装(实测 Microsoft YaHei 误报) */
const glyphCheckCache = new Map<string, boolean>()
export function isFontAvailable(family: string): boolean {
  const name = family.trim().replace(/^['"]|['"]$/g, '')
  if (!name) return true
  const cached = glyphCheckCache.get(name)
  if (cached !== undefined) return cached
  const probe = (font: string) => {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return NaN
    ctx.font = `48px ${font}`
    return ctx.measureText('笔记 ABC abc 012 {,}').width
  }
  const available =
    probe(`"${name}", monospace`) !== probe('monospace') ||
    probe(`"${name}", serif`) !== probe('serif')
  glyphCheckCache.set(name, available)
  return available
}
