import { describe, expect, it } from 'vitest'
import { EditorState } from '@tiptap/pm/state'
import { Node as PMNode } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'

import { LiveEditorController, liveSchema } from './live-editor-controller'

/**
 * P1 守门:同步边界全链路(headless,真实 PM 事务)。
 * 每个用例:content → controller → PM 文档 → 真实事务编辑 → onUpdate
 * → 断言产出 content(未动块逐字节原样,dirty 块反映编辑)。
 */

const CONTENT = [
  '# 项目笔记', // 块 0
  '', //
  '目标是把实时预览做到 Typora 水平。', // 块 2
  '', //
  '- 要点一', // 块 4
  '- 要点二', // (同一列表块)
  '', //
  '```ts', // 块 6:围栏
  'const x = 1',
  '```',
  '', //
  'Setext 标题', // 块 8(序列化会规范化为 ATX)
  '===',
  '', //
  '收尾段落。',
].join('\n')

function setup(content = CONTENT) {
  const controller = new LiveEditorController(content)
  const doc = PMNode.fromJSON(liveSchema, controller.buildDocJson())
  const state = EditorState.create({ schema: liveSchema, doc })
  controller.seed(state.doc)
  return { controller, state }
}

/** 应用事务并产出新 content(编辑必然产生变化,null 视为接线断裂) */
const apply = (controller: LiveEditorController, state: EditorState, tr: Transaction) => {
  const next = state.apply(tr)
  const content = controller.onUpdate(next.doc)
  if (content === null) throw new Error('编辑事务未产出新 content(接线断裂)')
  return { content, state: next }
}

/** 找到第 n 个匹配谓词的顶层节点区间 [from, to](doc 坐标) */
function findBlock(state: EditorState, predicate: (node: PMNode) => boolean, nth = 0) {
  let seen = -1
  let pos = 0
  for (let i = 0; i < state.doc.childCount; i++) {
    const node = state.doc.child(i)
    const from = pos
    pos += node.nodeSize
    if (predicate(node)) {
      seen++
      if (seen === nth) return { from, to: pos, node }
    }
  }
  throw new Error('block not found')
}

describe('LiveEditorController 同步边界', () => {
  it('零编辑:序列化输出与原文逐字节相等(初始接线)', () => {
    const { state, controller } = setup()
    // 未经事务也要能直接产出原文
    expect(controller.onUpdate(state.doc)).toBeNull() // 无变化 → null
  })

  it('段内键入:只有该块变化,其余字节不动', () => {
    const { controller, state } = setup()
    const para = findBlock(state, (n) => n.type.name === 'paragraph' && n.textContent.includes('Typora'))
    const inside = para.from + 1 + '目标是把实时预览做到 '.length
    const { content } = apply(controller, state, state.tr.insertText('真·', inside, inside))
    expect(content).toContain('真·Typora')
    // 未动块逐字节保持
    expect(content).toContain('# 项目笔记\n\n')
    expect(content).toContain('- 要点一\n- 要点二\n')
    expect(content).toContain('```ts\nconst x = 1\n```\n')
    expect(content).toContain('Setext 标题\n===\n') // Setext 块未编辑 → 原样(不被规范化!)
  })

  it('删除整块:该块从输出消失,其余原样', () => {
    const { controller, state } = setup()
    const list = findBlock(state, (n) => n.type.name === 'bulletList')
    const { content } = apply(controller, state, state.tr.delete(list.from, list.to))
    expect(content).not.toContain('要点一')
    expect(content).toContain('# 项目笔记\n\n目标是把实时预览做到 Typora 水平。')
    expect(content).toContain('Setext 标题\n===')
  })

  it('Enter 拆分段落:两半都在,其余隔离', () => {
    const { controller, state } = setup()
    const para = findBlock(state, (n) => n.type.name === 'paragraph' && n.textContent.includes('Typora'))
    const splitAt = para.from + 1 + 3
    const { content } = apply(controller, state, state.tr.split(splitAt))
    expect(content).toContain('目标是')
    expect(content).toContain('把实时预览做到 Typora 水平。')
    expect(content).toContain('```ts\nconst x = 1\n```\n')
  })

  it('编辑 Setext 块:只有它被规范化为 ATX', () => {
    const { controller, state } = setup()
    // 第 2 个 heading 才是 Setext 块(第 1 个是 ATX 的 # 项目笔记)
    const heading = findBlock(state, (n) => n.type.name === 'heading', 1)
    const end = heading.to - 1
    const { content } = apply(controller, state, state.tr.insertText('!', end, end))
    expect(content).toContain('# Setext 标题!')
    expect(content).not.toContain('===')
    // 其余块原样
    expect(content).toContain('```ts\nconst x = 1\n```\n')
    expect(content.endsWith('收尾段落。')).toBe(true)
  })

  it('外部重载:rebind 重建后新 content 可编辑', () => {
    const { controller } = setup()
    const fresh = '# 新笔记\n\n全新正文。\n'
    const json = controller.rebind(fresh)
    const doc = PMNode.fromJSON(liveSchema, json)
    const state = EditorState.create({ schema: liveSchema, doc })
    controller.seed(state.doc)
    expect(controller.onUpdate(state.doc)).toBeNull() // 未编辑 → 与新原文一致
    const para = findBlock(state, (n) => n.type.name === 'paragraph')
    const { content } = apply(
      controller,
      state,
      state.tr.insertText('!', para.from + 1 + '全新正文'.length, para.from + 1 + '全新正文'.length),
    )
    expect(content).toBe('# 新笔记\n\n全新正文!。\n')
  })
})
