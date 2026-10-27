/** 简易相对时间，避免为一个展示引一个日期库 */
export function fromNow(ts: number): string {
  const diff = Date.now() - ts
  const MIN = 60_000
  const HOUR = 60 * MIN
  const DAY = 24 * HOUR
  if (diff < MIN) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MIN)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  return `${Math.floor(diff / DAY)} 天前`
}
