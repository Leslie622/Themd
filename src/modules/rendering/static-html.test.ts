import { describe, expect, it } from 'vitest'
import { renderStaticHtml } from './static-html'

/** 语料外节点的静态渲染回归(金样守门不覆盖的 PM 特有节点在此补位) */
describe('renderStaticHtml 语料外节点', () => {
  it('frontmatter 隐藏不崩,正文正常渲染', () => {
    const html = renderStaticHtml('---\ntitle: 笔记\n tags: [a]\n---\n\n# 标题\n\n正文。')
    expect(html).toContain('<h1 id="标题">标题</h1>')
    expect(html).toContain('<p>正文。</p>')
    expect(html).not.toContain('live-frontmatter')
    expect(html).not.toContain('title:')
  })

  it('空 frontmatter 同样隐藏', () => {
    const html = renderStaticHtml('---\n---\n\n只有正文。')
    expect(html).toContain('<p>只有正文。</p>')
  })
})
