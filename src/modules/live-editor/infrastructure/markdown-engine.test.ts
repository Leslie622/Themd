import { describe, expect, it } from 'vitest'

import { joinBlocks, markDirty, splitBlocks } from '../domain/block-source-map'
import { roundTripBlockMarkdown, serializeLiveBlocks } from './markdown-engine'

/**
 * P0 守门测试:字节保真协议。
 * - 协议零 diff:parse → 不编辑 → serialize 必须逐字节相等(红线)
 * - 单块编辑隔离:dirty 块之前的原文 = 输出的严格前缀,之后的原文 = 严格后缀(红线)
 * - 原始序列化保真:关键语法类经 PM 往返逐字节稳定(风格档案的基线)
 */

/** 多块真实笔记语料 */
const DOC_CORPUS: string[] = [
  '# 项目笔记\n\n目标是把实时预览做到 Typora 水平。\n\n## 要点\n\n- 块级显现\n- 渲染态编辑\n- [ ] 任务项\n\n> 引用一段\n> 第二行\n\n| 语法 | 状态 |\n| --- | ---: |\n| 表格 | 99 |\n\n```ts\nconst x: number = 1\n```\n\n![截图](assets/shot-1234abcd.png)\n\n[外链](https://example.com) 与 **粗体**、*斜体*、~~删除~~、`代码`。\n',
  '---\ntitle: 每日笔记\ndate: 2026-11-01\n---\n\n## 今日\n\n1. 早起\n2. 写代码\n\n---\n\n完。\n',
  '第一段直接开始。\n\n```python\nprint("hello")\n\nprint("world")\n```\n\n结尾段。',
]

/** 单块关键语法:原始序列化保真基线(必须逐字节稳定) */
const STABLE_BLOCKS: string[] = [
  '# 一级标题',
  '###### 六级标题',
  '正文 **粗体** 与 *斜体* 与 ***粗斜***',
  '~~删除线~~ 与 `行内代码`',
  '- 无序一\n- 无序二',
  '1. 有序一\n2. 有序二',
  '- [ ] 待办\n- [x] 已办',
  '> 引用块',
  '```js\nconst a = 1\n```',
  '[链接](https://example.com) 与 ![图片](assets/x.png)',
  '![带标题](y.png "标题")',
  '| a | b |\n| --- | ---: |\n| 1 | 2 |',
  '| 左 | 中 | 右 |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |',
  '---',
]

describe('markdown-engine 字节保真协议', () => {
  it('协议零 diff:不编辑时序列化逐字节等于原文', () => {
    for (const content of DOC_CORPUS) {
      const out = serializeLiveBlocks(splitBlocks(content))
      expect(out, JSON.stringify(content)).toBe(content)
    }
  })

  it('单块编辑且该块序列化保真时,输出与原文逐字节相等(协议接线验证)', () => {
    for (const content of DOC_CORPUS) {
      const blocks = splitBlocks(content)
      const contentful = blocks.filter((b) => b.text.trim() !== '')
      const victim = contentful[Math.floor(contentful.length / 2)]
      const edited = markDirty(blocks, victim.from, victim.from + 1)
      expect(serializeLiveBlocks(edited), JSON.stringify(victim.text)).toBe(content)
    }
  })

  it('单块编辑隔离:dirty 块前后原文严格保持为输出的前缀/后缀', () => {
    // Setext 块序列化为 ATX(已知规范化):正好用来验证「失真只发生在 dirty 块」
    const content = '# 前标\n\nSetext 标题\n===\n\n中间段落\n\n```js\nx\n```\n\n尾段。'
    const blocks = splitBlocks(content)
    const victim = blocks.find((b) => b.text.startsWith('Setext'))
    expect(victim).toBeDefined()
    expect(roundTripBlockMarkdown(victim!.text.replace(/\n$/, ''))).not.toBe(
      victim!.text.replace(/\n$/, ''),
    )
    const edited = markDirty(blocks, victim!.from, victim!.from + 1)
    const out = serializeLiveBlocks(edited)
    // 前缀:到 dirty 块起点为止的原文;后缀:dirty 块终点之后的原文(含全部后继块)
    expect(out.startsWith(content.slice(0, victim!.from))).toBe(true)
    expect(out.endsWith(content.slice(victim!.to))).toBe(true)
    // dirty 块本身确实被改写为 ATX
    expect(out).toContain('# Setext 标题')
    expect(out).not.toContain('===')
  })

  it('关键语法单块往返逐字节稳定(序列化保真基线)', () => {
    const failures: string[] = []
    for (const text of STABLE_BLOCKS) {
      if (roundTripBlockMarkdown(text) !== text) failures.push(text)
    }
    expect(failures, `往返失真: ${JSON.stringify(failures)}`).toEqual([])
  })

  it('joinBlocks 守门:语料重组逐字节还原(与协议测试互证)', () => {
    for (const content of DOC_CORPUS) {
      expect(joinBlocks(splitBlocks(content))).toBe(content)
    }
  })
})
