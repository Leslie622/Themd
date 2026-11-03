import { describe, expect, it, vi } from 'vitest'

// vitest 默认桩掉 CSS 导入(?raw 也返回空串),这里用覆盖断言点的精简 fixture
vi.mock('@/styles/theme-base.css?raw', () => ({
  default: `
.themd-prose {
  color: var(--t-root-color, var(--foreground));
}
.themd-prose p {
  margin-bottom: var(--t-p-margin-bottom, 0.8em);
}
.themd-prose h1 {
  font-size: var(--t-h1-size, 2em);
}
.themd-prose pre {
  overflow-x: auto;
}
.themd-prose[style*="--t-del-offset"],
.themd-prose[style*="--t-del-thickness"] {
  --t-del-line: none;
}
.themd-prose[style*="--t-del-offset"] del,
.themd-prose[style*="--t-del-thickness"] del {
  text-decoration-line: none;
}
`,
}))

import { buildPortableCss, portableCssFileName } from './portable-css'
import type { ThemeFile } from './schema'

function theme(partial: Partial<ThemeFile> = {}): ThemeFile {
  return { version: 1, id: 't', name: '测试主题', tokens: {}, ...partial }
}

describe('buildPortableCss', () => {
  it('容器选择器随目标端改写,theme-base 不再出现 .themd-prose(Typora)', () => {
    const css = buildPortableCss(theme({ tokens: { 'root.size': '16px' } }), 'typora')
    expect(css).toContain('#write {')
    expect(css).toContain('#write p {')
    expect(css).toContain('#write pre')
    expect(css).not.toContain('.themd-prose')
  })

  it('VSCode / GitHub / 通用各自落到对应容器', () => {
    expect(buildPortableCss(theme(), 'vscode')).toContain('.vscode-body h1')
    expect(buildPortableCss(theme(), 'github')).toContain('.markdown-body h1')
    expect(buildPortableCss(theme(), 'generic')).toContain('.themd-prose h1')
  })

  it('令牌编译内联到容器块,未设令牌不产出变量', () => {
    const css = buildPortableCss(theme({ tokens: { 'root.size': '18px' } }), 'typora')
    expect(css).toContain('--t-root-size: 18px;')
    expect(css).not.toContain('--t-root-leading:')
  })

  it('暗色套存在时按 prefers-color-scheme 双发,无暗色套不产出媒体块', () => {
    const withDark = buildPortableCss(
      theme({ tokens: { 'root.color': '#111' }, dark: { 'root.color': '#eee' } }),
      'typora',
    )
    expect(withDark).toContain('@media (prefers-color-scheme: dark)')
    expect(withDark).toContain('--t-root-color: #eee;')
    const noDark = buildPortableCss(theme({ tokens: { 'root.color': '#111' } }), 'typora')
    expect(noDark).not.toContain('prefers-color-scheme')
  })

  it('app.bg 画布令牌分流到 body 块', () => {
    const css = buildPortableCss(theme({ tokens: { 'app.bg': '#f5f5f5' } }), 'typora')
    expect(css).toContain('body {')
    expect(css).toContain('background: #f5f5f5;')
  })

  it('[style*=] 守卫规则剥除;del 自绘删除线按令牌有无条件补发', () => {
    const plain = buildPortableCss(theme(), 'typora')
    expect(plain).not.toContain('[style*=')
    expect(plain).not.toContain('linear-gradient(var(--t-del-text-color')

    const custom = buildPortableCss(theme({ tokens: { 'del.offset': '2px' } }), 'typora')
    expect(custom).toContain('--t-del-line: none;')
    expect(custom).toContain('linear-gradient(var(--t-del-text-color')
  })

  it('应用级 UI 令牌引用替换为 inherit(不依赖 Themd 界面变量)', () => {
    const css = buildPortableCss(theme(), 'typora')
    expect(css).not.toContain('var(--foreground)')
    expect(css).toContain('color: var(--t-root-color, inherit)')
  })

  it('extraCss 跟随目标容器改写作用域', () => {
    const css = buildPortableCss(
      theme({ tokens: {}, extraCss: 'strong { letter-spacing: 0.05em; }' }),
      'typora',
    )
    expect(css).toContain('#write strong{')
    expect(css).not.toMatch(/\.themd-prose strong/)
  })

  it('文件名按目标端命名', () => {
    expect(portableCssFileName('我的主题', 'typora')).toBe('我的主题.typora.css')
    expect(portableCssFileName('我的主题', 'generic')).toBe('我的主题.portable.css')
  })
})
