import { describe, expect, it } from 'vitest'

import { liveSchema } from './live-editor-controller'

/**
 * 守门:schema 每个节点/标记必须有 toDOM。
 *
 * 背景:@tiptap/react 卸载 EditorContent 时 setProps({ nodeViews: {} })
 * 清空全部 NodeView 并重建文档视图,此时节点走默认序列化 spec.toDOM;
 * 只写 addNodeView 不写 renderHTML 的自定义节点会在这里抛
 * 「node.type.spec.toDOM is not a function」白屏(实时预览切视图触发)。
 * 新增自定义节点必须带 renderHTML 兜底(NodeView 缺席时的显示形态)。
 */
/** doc/text 是 PM 内置类型(引擎自带默认序列化);自定义节点必须显式提供 */
const BUILTIN_WITHOUT_TODOM = new Set(['doc', 'text'])

describe('live schema toDOM 完整性', () => {
  it('每个节点类型都有 toDOM(内置 doc/text 除外)', () => {
    const missing = Object.values(liveSchema.nodes)
      .filter((t) => !t.spec.toDOM && !BUILTIN_WITHOUT_TODOM.has(t.name))
      .map((t) => t.name)
    expect(missing).toEqual([])
  })

  it('每个标记类型都有 toDOM', () => {
    const missing = Object.values(liveSchema.marks)
      .filter((t) => !t.spec.toDOM)
      .map((t) => t.name)
    expect(missing).toEqual([])
  })

  it('公式块与 Front Matter 的兜底 toDOM 结构合法(卸载期重建路径)', () => {
    // node 环境无 DOM,不实际 renderSpec;校验 spec 是合法的数组描述
    // ['tag', attrs, 0](hole=0 表示内容插槽),PM 据此即可序列化
    // DOMOutputSpec 是元组联合类型,数字索引会触发 TS7053,统一放宽为 unknown[]
    const mathDom = liveSchema.nodes.mathBlock.spec.toDOM?.(
      liveSchema.nodes.mathBlock.create(undefined, liveSchema.text('E=mc^2')),
    ) as unknown[] | undefined
    expect(Array.isArray(mathDom)).toBe(true)
    // 契约 §3:块级公式规范外壳 p.katex-block(与静态侧 @mdit/plugin-katex 同型)
    expect(mathDom?.[0]).toBe('p')
    expect(mathDom?.[2]).toBe(0)

    const fmDom = liveSchema.nodes.frontMatter.spec.toDOM?.(
      liveSchema.nodes.frontMatter.create(undefined, liveSchema.text('title: x')),
    ) as unknown[] | undefined
    expect(Array.isArray(fmDom)).toBe(true)
    expect(fmDom?.[0]).toBe('div')
    expect(fmDom?.[2]).toBe(0)

    const inlineDom = liveSchema.nodes.mathInline.spec.toDOM?.(
      liveSchema.nodes.mathInline.create(undefined, liveSchema.text('x')),
    ) as unknown[] | undefined
    expect(Array.isArray(inlineDom)).toBe(true)
    expect(inlineDom?.[0]).toBe('span')
    expect(inlineDom?.[2]).toBe(0)
  })
})
