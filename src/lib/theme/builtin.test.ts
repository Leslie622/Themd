import { describe, expect, it } from 'vitest'

import { BUILTIN_THEMES } from './builtin'
import { TOKEN_VAR, type TokenKey } from './tokens'

/**
 * 内置主题钉值测试:GitHub 的令牌值逐项转写自 github-markdown-css v5.9.0
 * (github.com 真实 .markdown-body 样式的生成包),这里钉住关键值与「有意
 * 不设」的项,防止日后凭印象改回(如正文行高 1.5、表头无底色、p 10px)。
 */

const minimal = BUILTIN_THEMES.find((t) => t.id === 'default')
const github = BUILTIN_THEMES.find((t) => t.id === 'github')

describe('内置主题', () => {
  it('阵容 = 极简 + GitHub', () => {
    expect(BUILTIN_THEMES.map((t) => t.id)).toEqual(['default', 'github'])
    expect(minimal?.tokens).toEqual({})
  })

  it('GitHub 亮面关键值对齐 github-markdown-css v5.9.0', () => {
    const t = github!.tokens
    const expectToken = (key: TokenKey, v: string | undefined) =>
      expect({ [key]: t[key] }, key).toEqual({ [key]: v })
    // 正文:1.5 行高、10px 段距、#1f2328 前景(这些最容易被"凭感觉"改掉)
    expectToken('root.leading', '1.5')
    expectToken('root.color', '#1f2328')
    expectToken('p.marginBottom', '10px')
    // 标题:1.5rem/1rem 边距、h1/h2 边框带 b3 透明度
    expectToken('heading.marginTop', '1.5rem')
    expectToken('heading.marginBottom', '1rem')
    expectToken('h1.borderColor', '#d1d9e0b3')
    // 行内:链接常下划线;行内码 #818b981f
    expectToken('a.underline', 'always')
    expectToken('inlineCode.bg', '#818b981f')
    // 代码块:#f6f8fa + 1rem 内边距;hr 厚 .25em
    expectToken('codeBlock.bg', '#f6f8fa')
    expectToken('codeBlock.padding', '1rem')
    expectToken('hr.thickness', '.25em')
    // 表格全网格(源 th/td 四边 1px)
    expectToken('cell.border', '1px solid #d1d9e0')
    // 有意不设:表头无底色(仅 600)、复选框不设 accent、引用底色透明
    expectToken('th.bg', undefined)
    expectToken('task.accent', undefined)
    expectToken('quote.bg', undefined)
  })

  it('GitHub 暗面存在且为整体替换面:带齐全部存续键 + 暗色专属值', () => {
    const d = github!.dark
    expect(d).toBeDefined()
    const lightKeys = Object.keys(github!.tokens)
    const darkKeys = Object.keys(d!)
    // 结构性键(字号/字体/间距/行高)必须在暗面原样存续
    for (const key of lightKeys) {
      expect(darkKeys, `暗面缺少 ${key}`).toContain(key)
      expect(TOKEN_VAR[key as TokenKey]).toBeDefined()
    }
    // 暗色专属值(github-markdown-css dark 文件)
    expect(d!['root.bg']).toBe('#0d1117')
    expect(d!['root.color']).toBe('#f0f6fc')
    expect(d!['a.color']).toBe('#4493f8')
    expect(d!['inlineCode.bg']).toBe('#656c7633')
    expect(d!['codeBlock.bg']).toBe('#151b23')
    expect(d!['table.stripeBg']).toBe('#151b23')
    expect(d!['cell.border']).toBe('1px solid #3d444d')
    expect(d!['h1.borderColor']).toBe('#3d444db3')
    expect(d!['h6.color']).toBe('#9198a1')
    expect(d!['hr.color']).toBe('#3d444d')
  })
})
