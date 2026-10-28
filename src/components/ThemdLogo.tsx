/**
 * Themd 品牌 Logo(内联 SVG,按官方 logo 像素测量 1:1 重绘)。
 * 结构(测量基准:原图 1280x720,点阵区 5 列 × 4 行):
 * - 大圆点:直径 ~34(半径 17);圆点间细连接线粗 ~13
 * - T 形:顶行 4 个蓝点横连;第 3 列向下 2 个蓝点竖连
 * - 第 3 行第 3 列:与立柱【分离】的独立蓝点(官方设计的关键细节)
 * - 其余 13 格为浅灰点(蓝点略大,灰点略小)
 * 灰点用 currentColor + 透明度:亮色下浅灰、暗色下自动反白,任何渲染环境不丢。
 */

const COLS = [189, 239, 289, 339, 389] // 列心 x(间距 50)
const ROWS = [282, 335, 388, 439] // 行心 y(间距 52)
const BLUE_R = 17 // 蓝点半径(直径 34)
const GRAY_R = 14.5 // 灰点半径(直径 29,略小于蓝点)
const LINE_W = 13 // 连接线粗细
const ACCENT = '#0526ff'

export function ThemdLogo({ className }: { className?: string }) {
  const left = COLS[0] - GRAY_R - 3
  const top = ROWS[0] - GRAY_R - 3
  const X = (x: number) => x - left
  const Y = (y: number) => y - top
  const W = COLS[4] - COLS[0] + GRAY_R * 2 + 6
  const H = ROWS[3] - ROWS[0] + GRAY_R * 2 + 6

  // 灰点:T 形覆盖之外的所有格位
  const grayDots: [number, number][] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      const isBlue =
        (r === 0 && c >= 0 && c <= 3) || // 顶行 4 蓝点
        (c === 2 && r >= 1 && r <= 3) // 立柱列(行1-3,含底部独立点)
      if (!isBlue) grayDots.push([X(COLS[c]), Y(ROWS[r])])
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Themd" fill="none">
      {/* 细连接线(先画,圆点叠于其上) */}
      <g stroke={ACCENT} strokeWidth={LINE_W}>
        <line x1={X(COLS[0])} y1={Y(ROWS[0])} x2={X(COLS[3])} y2={Y(ROWS[0])} />
        <line x1={X(COLS[2])} y1={Y(ROWS[0])} x2={X(COLS[2])} y2={Y(ROWS[2])} />
      </g>
      {/* 蓝色大圆点 */}
      <g fill={ACCENT}>
        <circle cx={X(COLS[0])} cy={Y(ROWS[0])} r={BLUE_R} />
        <circle cx={X(COLS[1])} cy={Y(ROWS[0])} r={BLUE_R} />
        <circle cx={X(COLS[2])} cy={Y(ROWS[0])} r={BLUE_R} />
        <circle cx={X(COLS[3])} cy={Y(ROWS[0])} r={BLUE_R} />
        <circle cx={X(COLS[2])} cy={Y(ROWS[1])} r={BLUE_R} />
        <circle cx={X(COLS[2])} cy={Y(ROWS[2])} r={BLUE_R} />
        <circle cx={X(COLS[2])} cy={Y(ROWS[3])} r={BLUE_R} />
      </g>
      {/* 灰点:currentColor + 低透明度,明暗模式自适应 */}
      <g fill="currentColor" fillOpacity={0.16}>
        {grayDots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={GRAY_R} />
        ))}
      </g>
    </svg>
  )
}
