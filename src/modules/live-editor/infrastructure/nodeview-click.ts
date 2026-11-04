/**
 * 折叠型 NodeView 的单击展开(front matter/数学/mermaid 共用):
 * 在 dom 的非 contentDOM 区(状态条/公式渲染/svg)按下时,显式持焦并把光标
 * 送进内容首。必须拦截的原因:这些区域是 user-select:none 或非文本渲染物,
 * 浏览器原生 caret 与 PM posAtCoords 都可能落不进内容(Selection.near 会把
 * 光标放到节点之后的块首),单击展开(SelectionEditingClass 按光标位置挂类)
 * 就永远等不到选区变化,实测只有双击(NodeSelection)才误触展开。
 */
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

export function clickToContent(
  editor: Editor,
  getPos: () => number | undefined,
  dom: HTMLElement,
  contentDOM: HTMLElement,
): void {
  dom.addEventListener('mousedown', (ev) => {
    if (contentDOM.contains(ev.target as Node)) return
    ev.preventDefault()
    ev.stopPropagation()
    const pos = getPos()
    if (typeof pos !== 'number') return
    // 先持焦再提交:SelectionEditingClass 的装饰带焦点门,顺序反了本次
    // dispatch 算装饰时仍是失焦态,类挂不上
    editor.view.focus()
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos + 1)))
  })
}
