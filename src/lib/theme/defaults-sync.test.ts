import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { THEME_BASE_DEFAULTS } from './defaults'
import { TOKEN_VAR, type TokenKey } from './tokens'

/**
 * 守门测试:theme-base.css 的 var() 回落值与 THEME_BASE_DEFAULTS 常量表
 * 必须一致(常表是占位符的单一来源,CSS 是权威渲染样式)。
 * 机械解析 CSS 源码里的 `var(--t-*, fallback)`,逐项比对——改 CSS 回落值
 * 不同步常表(或反之)时此处立刻红,占位符不会再悄悄失真。
 */

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../../styles/theme-base.css'), 'utf8')

/** CSS 里 var(--t-x, fallback) 的全部回落值(fallback 可含嵌套括号,如 oklch()/var());未带回落的不收 */
const CSS_FALLBACKS = new Map<string, string>()
for (const m of css.matchAll(/var\((--t-[a-z0-9-]+),\s*((?:[^()]|\([^()]*\))*)\)/g)) {
  const [, varName, fallback] = m
  if (!CSS_FALLBACKS.has(varName)) CSS_FALLBACKS.set(varName, fallback.trim())
}

const VAR_TO_KEY = new Map<string, TokenKey>(
  Object.entries(TOKEN_VAR).map(([k, v]) => [v, k as TokenKey]),
)

/** 字体栈是长列表,占位符场景用不到,不进常表。
 *  双字体改造后 CSS 只消费合并栈(--t-root-font 等),latin/cjk 分令牌的
 *  回落在 compile.ts,同样不进常表——全部豁免。 */
const FONT_STACK_VARS = new Set<string>(
  Object.values(TOKEN_VAR).filter((v) => v.includes('-font')),
)

/** 常表值与 CSS 回落值在「展示语义」上等价(0 与 0s、0px 同义) */
const norm = (v: string) => v.replace(/\s+/g, ' ').replace(/^(-|\+)?0(?=[.a-z])/, '').trim()

describe('theme-base.css 回落值 ⇄ THEME_BASE_DEFAULTS 同步', () => {
  it('常表里的每一项与 CSS var() 回落一致', () => {
    const diffs: string[] = []
    for (const [key, expected] of Object.entries(THEME_BASE_DEFAULTS) as [TokenKey, string][]) {
      const varName = TOKEN_VAR[key]
      const actual = varName ? CSS_FALLBACKS.get(varName) : undefined
      if (actual === undefined) diffs.push(`${key}: 常表=${expected} 但 CSS 无 ${varName} 回落`)
      else if (norm(actual) !== norm(expected)) diffs.push(`${key}: 常表=${expected} CSS=${actual}`)
    }
    expect(diffs).toEqual([])
  })

  it('CSS 里每个令牌回落都进了常表(新增令牌必填,防止再靠人肉同步)', () => {
    // hover 态回落是链式(hoverColor→color、hoverLine→underlineColor),静态端无意义,豁免
    const CHAIN_FALLBACK_KEYS = new Set<TokenKey>(['a.hoverColor', 'a.hoverLineColor'])
    const missing: string[] = []
    for (const [varName, fallback] of CSS_FALLBACKS) {
      const key = VAR_TO_KEY.get(varName)
      if (!key) continue // 编译器展开的中间变量(a-underline-line/del-line 等)不在令牌表,豁免
      if (FONT_STACK_VARS.has(varName)) continue
      if (fallback.startsWith('var(')) {
        // 链式回落:终点静态值已进常表的(h3.size 等)不豁免,链的中间跳板(hover 色)豁免
        if (CHAIN_FALLBACK_KEYS.has(key)) continue
        continue // 其余链式回落(h3.font→heading.font→inherit 等)占位符场景用不到,豁免
      }
      if (!(key in THEME_BASE_DEFAULTS)) missing.push(`${key} (${varName}, ${fallback})`)
    }
    expect(missing).toEqual([])
  })
})
