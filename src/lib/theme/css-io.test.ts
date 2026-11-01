import { describe, expect, it } from 'vitest'

import { exportThemeCss } from './css-io'
import type { ThemeFile } from './schema'

const theme = (tokens: ThemeFile['tokens']): ThemeFile => ({
  version: 1,
  id: 't1',
  name: '测试主题',
  tokens,
})

describe('exportThemeCss', () => {
  it('root 令牌进作用域块', () => {
    const css = exportThemeCss(theme({ 'root.bg': '#ffffff' }))
    expect(css).toContain('.themd-prose {')
    expect(css).toContain('background: #ffffff;')
  })

  it('app.* 整体令牌分流到 body 块,不混入作用域块', () => {
    const css = exportThemeCss(
      theme({ 'root.bg': '#ffffff', 'app.bg': 'url("data:image/webp;base64,xx") center / cover no-repeat' }),
    )
    const scopeBlock = css.slice(css.indexOf('.themd-prose {'), css.indexOf('body {'))
    expect(scopeBlock).toContain('background: #ffffff;')
    expect(scopeBlock).not.toContain('app-bg')
    const bodyBlock = css.slice(css.indexOf('body {'))
    expect(bodyBlock).toContain('background: url("data:image/webp;base64,xx") center / cover no-repeat;')
  })

  it('未设 app.* 时不输出 body 块', () => {
    const css = exportThemeCss(theme({ 'root.size': '18px' }))
    expect(css).not.toContain('body {')
  })
})
