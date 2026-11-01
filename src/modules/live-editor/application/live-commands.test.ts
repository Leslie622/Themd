import { describe, expect, it } from 'vitest'
import { EditorState } from '@tiptap/pm/state'
import { Node as PMNode } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'

import { LiveEditorController, liveSchema } from './live-editor-controller'
import { nodeSelectionMarkdown, selectionToMarkdown } from './live-commands'

/**
 * 剪贴板序列化守门:此前 copySelection/cutSelection 用 textBetween 取纯文本,
 * 图片等原子节点取出为空串 → 剪切静默失效。改走 markdown 序列化后,
 * 含图片选区必须得到完整 markdown(尺寸后缀保留)。
 */

function setup(content: string) {
  const controller = new LiveEditorController(content)
  const doc = PMNode.fromJSON(liveSchema, controller.buildDocJson())
  const state = EditorState.create({ schema: liveSchema, doc })
  controller.seed(state.doc)
  return { controller, state }
}

/** 第 i 个顶层块:[块起点, 块终点) */
function blockRange(state: EditorState, i: number): { from: number; to: number } {
  let pos = 0
  for (let k = 0; k <= i; k++) {
    const node = state.doc.child(k)
    if (k === i) return { from: pos, to: pos + node.nodeSize }
    pos += node.nodeSize
  }
  throw new Error(`无第 ${i} 块`)
}

/** 只包 state 的假 Editor(命令函数只读 state) */
const fakeEditor = (state: EditorState) => ({ state }) as unknown as Editor

describe('live-commands 选区序列化', () => {
  it('含图片的选区序列化为完整 markdown(尺寸后缀保留)', () => {
    const { state } = setup('前文。\n\n![截图](a.png =300x)\n')
    // v3 Image 默认块级:图片本身是顶层块 [from, to)
    const img = blockRange(state, 1)
    expect(selectionToMarkdown(state.doc, img.from, img.to)).toBe('![截图](a.png =300x)')
  })

  it('NodeSelection 选中图片 → nodeSelectionMarkdown 输出图片 markdown', () => {
    const base = setup('前文。\n\n![截图](b.png =300x200)\n')
    const img = blockRange(base.state, 1)
    const state = base.state.apply(
      base.state.tr.setSelection(NodeSelection.create(base.state.doc, img.from)),
    )
    expect(nodeSelectionMarkdown(fakeEditor(state))).toBe('![截图](b.png =300x200)')
  })

  it('非节点选区 → nodeSelectionMarkdown 返回 null(菜单不误判图片上下文)', () => {
    const base = setup('正文 **加粗**。\n')
    const para = blockRange(base.state, 0)
    const state = base.state.apply(
      base.state.tr.setSelection(TextSelection.create(base.state.doc, para.from + 1, para.to - 1)),
    )
    expect(nodeSelectionMarkdown(fakeEditor(state))).toBeNull()
  })

  it('文本选区保持 markdown 形状(粗体标记不丢)', () => {
    const { state } = setup('正文 **加粗**。\n')
    const para = blockRange(state, 0)
    expect(selectionToMarkdown(state.doc, para.from + 1, para.to - 1)).toBe('正文 **加粗**。')
  })
})
