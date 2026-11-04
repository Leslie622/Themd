import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown-renderer'

describe('gfm-alerts 规则', () => {
  it('标记独占首段:blockquote 变 callout div + 标题行', () => {
    const html = renderMarkdown('> [!NOTE]\n> 提示内容').html
    expect(html).toContain('<div class="themd-callout themd-callout-note" data-alert="note">')
    expect(html).toContain('themd-callout-title')
    expect(html).toContain('Note</p>')
    expect(html).toContain('提示内容')
    expect(html).not.toContain('[!NOTE]')
    expect(html).not.toContain('blockquote')
  })

  it('五类类型各自成型', () => {
    for (const t of ['TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
      expect(renderMarkdown(`> [!${t}]\n> x`).html).toContain(`themd-callout-${t.toLowerCase()}`)
    }
  })

  it('多段内容与嵌套列表完整保留', () => {
    const html = renderMarkdown('> [!WARNING]\n> 第一段\n>\n> - 列表项\n> - 第二项\n>\n> 第二段').html
    expect(html).toContain('themd-callout-warning')
    expect(html).toContain('第一段')
    expect(html).toContain('<li>列表项</li>')
    expect(html).toContain('第二段')
  })

  it('嵌套引用不被深度扫描搞乱', () => {
    const html = renderMarkdown('> [!TIP]\n> 外层\n> > 内层引用\n> 回到外层').html
    expect(html).toContain('themd-callout-tip')
    expect(html).toContain('外层')
    expect(html).toContain('内层引用')
  })

  it('标记与正文同段:标题前插,正文保留', () => {
    const html = renderMarkdown('> [!NOTE]\n> 正文第一行\n> 正文第二行').html
    expect(html).toContain('themd-callout-title')
    expect(html).toContain('正文第一行')
    expect(html).toContain('正文第二行')
  })

  it('标记不分大小写:小写/混合大小写均识别,未知类型仍降级', () => {
    expect(renderMarkdown('> [!note]\n> x').html).toContain('themd-callout-note')
    expect(renderMarkdown('> [!Warning]\n> x').html).toContain('themd-callout-warning')
    expect(renderMarkdown('> [!CUSTOM]\n> x').html).toContain('<blockquote>')
  })

  it('普通引用不受影响', () => {
    const html = renderMarkdown('> 普通引用').html
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('themd-callout')
  })

  it('前文多个 blockquote 混排正常', () => {
    const html = renderMarkdown('> 普通引用\n\n> [!NOTE]\n> 提示\n\n> 又一个普通').html
    expect(html).toContain('<blockquote>')
    expect(html).toContain('themd-callout-note')
    expect((html.match(/<blockquote>/g) ?? []).length).toBe(2)
  })
})
