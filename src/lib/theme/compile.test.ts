import { describe, expect, it } from 'vitest'
import { compileTokens } from './compile'
import type { ThemeTokens } from './tokens'

/**
 * 字体拼栈守门:合并栈(--t-*-font)是合法 font-family 声明值。
 * CSS 全局关键字(inherit 等)只能独立占整条属性值,出现在族名列表中间
 * 会让整条声明在计算值阶段作废、字体静默回落——标题族曾因此全部失效。
 * 任何拼栈改动都不得让 inherit/initial/var(/unset 混进栈文本。
 */

const KEYWORD_PATTERN = /\b(inherit|initial|unset|revert|revert-layer)\b|\bvar\(/

describe('compileTokens 字体拼栈', () => {
  it('共用标题:latin+cjk 拼一条栈,latin 在前,无非法关键字', () => {
    const vars = compileTokens({
      'heading.fontLatin': 'Arial Black',
      'heading.fontCjk': '黑体',
    } as ThemeTokens)
    const stack = vars['--t-heading-font']
    expect(stack).toContain("'Arial Black'")
    expect(stack).toContain('黑体')
    expect(stack.indexOf('Arial Black')).toBeLessThan(stack.indexOf('黑体'))
    expect(stack).not.toMatch(KEYWORD_PATTERN)
  })

  it('级别标题:接上游已拼栈文本(编译期展开继承),不再产出 var() 尾', () => {
    const vars = compileTokens({
      'root.fontLatin': 'Georgia',
      'heading.fontCjk': '黑体',
      'h1.fontLatin': 'Impact',
    } as ThemeTokens)
    // h1 自身族在前,heading 栈整段接尾(含其 cjk 与 root 回落),全程无关键字
    const h1 = vars['--t-h1-font']
    expect(h1).toContain('Impact')
    expect(h1).toContain('黑体')
    expect(h1).toContain('Georgia')
    expect(h1).not.toMatch(KEYWORD_PATTERN)
    expect(vars['--t-heading-font']).not.toMatch(KEYWORD_PATTERN)
    expect(vars['--t-root-font']).not.toMatch(KEYWORD_PATTERN)
  })

  it('行内标记:上游(正文根)未设时接基础回落链,同样无关键字', () => {
    const vars = compileTokens({ 'strong.fontCjk': '楷体' } as ThemeTokens)
    const stack = vars['--t-strong-font']
    expect(stack).toContain('楷体')
    expect(stack).not.toMatch(KEYWORD_PATTERN)
  })

  it('只设 cjk 不设 latin:栈里仍无关键字,含中文族与回落', () => {
    const vars = compileTokens({ 'h2.fontCjk': '宋体' } as ThemeTokens)
    expect(vars['--t-h2-font']).toContain('宋体')
    expect(vars['--t-h2-font']).not.toMatch(KEYWORD_PATTERN)
  })

  it('空字符串值视同未设置,不产出变量', () => {
    const vars = compileTokens({
      'heading.fontLatin': '',
      'heading.fontCjk': '  ',
    } as ThemeTokens)
    expect(vars['--t-heading-font']).toBeUndefined()
  })
})
