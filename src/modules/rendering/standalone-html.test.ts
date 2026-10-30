import { describe, expect, it } from 'vitest'
import { buildStandaloneHtml } from './standalone-html'

describe('buildStandaloneHtml', () => {
  it('creates a self-contained document with escaped title and preview styles', () => {
    const html = buildStandaloneHtml({ id: '1', title: '<unsafe>', content: '# Hello', updatedAt: 1 })
    expect(html).toContain('&lt;unsafe&gt;')
    expect(html).toContain('.themd-prose')
    expect(html).toContain('<h1 id="hello">Hello</h1>')
  })
})
