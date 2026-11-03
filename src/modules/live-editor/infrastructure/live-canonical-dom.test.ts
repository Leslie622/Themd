// @vitest-environment happy-dom
/**
 * 编辑面规范结构守门(渲染统一第 4 步,I4 的结构侧验收)。
 *
 * 真实 Editor 实例(happy-dom)渲染同一语料,断言编辑面 DOM 命中契约
 * 规范结构(任务列表/提示块),私有结构(data-type/label/div 包装)为零。
 * 样式级(computed style)一致性属浏览器 IAB 抽查,结构在此常驻把关。
 */
import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'

import { getMarkdownManager } from './markdown-engine'
import { liveExtensions } from './tiptap-setup'

function renderInEditor(markdown: string): string {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: [...liveExtensions()],
    content: getMarkdownManager().parse(markdown),
  })
  const html = editor.view.dom.innerHTML
  editor.destroy()
  return html
}

describe('编辑面规范结构守门(第 4 步 I4)', () => {
  it('任务列表:li > p > input+文本(md-it 宽松形态),无 label/div/data-type 私有结构', () => {
    const html = renderInEditor('- [ ] 未完成\n- [x] 已完成')
    expect(html).toContain('<ul class="contains-task-list"')
    // 勾选框 = 首段内容头部的 Widget 装饰(PM 会附 ProseMirror-widget 类)
    expect(html).toMatch(/<li class="task-list-item"><p><input class="task-list-item-checkbox[^"]*"/)
    expect(html).toContain('type="checkbox"')
    // 已勾项勾选态同步到 input
    expect(html).toContain('checked=""')
    expect(html).not.toContain('data-type')
    expect(html).not.toContain('<label')
    expect(html).not.toContain('data-checked')
  })

  it('提示块:div 直出 + 标题行 Widget(首子,规范结构),无 NodeView 内层包装', () => {
    const html = renderInEditor('> [!NOTE]\n> 正文一段。')
    expect(html).toContain('themd-callout themd-callout-note')
    expect(html).toContain('data-alert="note"')
    expect(html).toContain('<p class="themd-callout-title')
    expect(html).toContain('themd-callout-icon')
    // 标题行是 div 首子,正文段落是兄弟(与静态侧同构,无嵌套包装)
    expect(html).toMatch(/<p class="themd-callout-title[^"]*"[^>]*>[^<]*<svg[\s\S]*?<\/p><p>正文一段。<\/p>/)
  })

  it('普通引用不受提示块改造影响', () => {
    const html = renderInEditor('> 普通引用。')
    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('themd-callout')
  })
})
