import { describe, expect, it } from 'vitest'

import { cssColorToRgba, oklchToRgba, type RgbaColor } from './css-color'

/**
 * 真值锚定:全部来自 Chromium(WebView2 同源)1×1 canvas getImageData 实测。
 * ±1 容差:数学层的四舍五入与画布量化在个别分量上可能差一个最低位;
 * alpha 通道 canvas 有预乘往返误差,容差放宽到 ±0.01。
 * 改动转换数学时,先用浏览器重测再改这里(取值脚本见测试底部注释)。
 */

const expectNear = (actual: RgbaColor | null, r: number, g: number, b: number, a: number) => {
  expect(actual).not.toBeNull()
  const c = actual as RgbaColor
  expect(Math.abs(c.r - r)).toBeLessThanOrEqual(1)
  expect(Math.abs(c.g - g)).toBeLessThanOrEqual(1)
  expect(Math.abs(c.b - b)).toBeLessThanOrEqual(1)
  expect(Math.abs(c.a - a)).toBeLessThanOrEqual(0.01)
}

describe('oklchToRgba:浏览器真值锚定(defaults.ts 全部唯一色值)', () => {
  it.each([
    ['oklch(0.9 0 0)', 222, 222, 222, 1],
    ['oklch(0.96 0 0)', 242, 242, 242, 1],
    ['oklch(0.97 0 0)', 245, 245, 245, 1],
    ['oklch(0.7 0 0)', 158, 158, 158, 1],
    ['oklch(0.55 0 0)', 113, 113, 113, 1],
    ['oklch(0.55 0.16 255)', 33, 113, 204, 1],
    ['oklch(0.6 0.15 150)', 37, 152, 77, 1],
    ['oklch(0.55 0.2 300)', 134, 74, 210, 1],
    ['oklch(0.6 0.13 75)', 173, 115, 0, 1],
    ['oklch(0.58 0.19 25)', 211, 58, 60, 1],
  ])('%s', (v, r, g, b, a) => {
    expectNear(oklchToRgba(v as string), r as number, g as number, b as number, a as number)
  })
})

describe('oklchToRgba:语法变体(CSS Color 4)', () => {
  it('亮度百分比 100%=1', () => {
    expectNear(oklchToRgba('oklch(90% 0 0)'), 222, 222, 222, 1)
  })
  it('色度百分比 100%=0.4(浏览器实测 40% ≡ 0.16)', () => {
    expectNear(oklchToRgba('oklch(0.55 40% 255)'), 33, 113, 204, 1)
  })
  it('none 分量按 0 参与转换', () => {
    expectNear(oklchToRgba('oklch(none 0 0)'), 0, 0, 0, 1)
  })
  it('deg 单位色相角', () => {
    expectNear(oklchToRgba('oklch(0.55 0.16 255deg)'), 33, 113, 204, 1)
  })
  it('斜线两侧无空格也能切分', () => {
    expectNear(oklchToRgba('oklch(0.55 0.16 255/50%)'), 33, 113, 204, 0.5)
  })
  it('alpha 百分比', () => {
    expectNear(oklchToRgba('oklch(0.55 0.16 255 / 50%)'), 33, 113, 204, 0.5)
  })
  it('alpha none 视为 0', () => {
    expect(oklchToRgba('oklch(0.55 0.16 255 / none)')?.a).toBe(0)
  })
  it('alpha 透传,不进通道数学(a=1 与 a=0.5 通道逐位一致)', () => {
    const opaque = oklchToRgba('oklch(0.5 0.1 30)')
    const half = oklchToRgba('oklch(0.5 0.1 30 / 0.5)')
    expect(half).toEqual({ ...opaque, a: 0.5 })
  })
})

describe('oklchToRgba:非法输入返回 null', () => {
  it.each([
    'oklch()',
    'oklch(0.5 0.1)',
    'oklch(0.5 0.1 30 /)',
    'oklch(abc 0 0)',
    'rgb(1, 2, 3)',
    '#ffffff',
    'oklch(0.5 0.1 30 grad)', // 罕见角单位不硬解,交给 canvas 层
  ])('%s', (v) => {
    expect(oklchToRgba(v)).toBeNull()
  })
})

describe('cssColorToRgba(canvas 兜底层)', () => {
  // node 环境无 2d 上下文:降级为 null,由调用方保持原状(取色器黑起步)
  it('无 canvas 环境返回 null', () => {
    expect(cssColorToRgba('red')).toBeNull()
  })
  it('哨兵字面值直接返回,不进画布判定', () => {
    expect(cssColorToRgba('#010203')).toEqual({ r: 1, g: 2, b: 3, a: 1 })
  })
})

/*
 * 浏览器真值取值脚本(在任意 Chromium 页面控制台执行):
 * (() => {
 *   const probe = (v) => {
 *     const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d');
 *     ctx.fillStyle = '#010203'; ctx.fillStyle = v;
 *     ctx.fillRect(0, 0, 1, 1);
 *     const d = ctx.getImageData(0, 0, 1, 1).data;
 *     return [d[0], d[1], d[2], +(d[3] / 255).toFixed(4)];
 *   };
 *   return Object.fromEntries(['oklch(0.9 0 0)', ...].map((v) => [v, probe(v)]));
 * })()
 */
