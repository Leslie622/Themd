import { describe, expect, it } from 'vitest'
import { joinBlocks, markDirty, splitBlocks } from './block-source-map'

/** 边缘语料:覆盖换行风格/围栏/ front matter/空行分布的切分与重组 */
const CORPUS: string[] = [
  '# 单块标题',
  '# 标题\n\n正文段落',
  '段落一\n\n段落二\n\n段落三',
  '没有结尾换行的段落',
  '\n\n# 前导空行的标题\n\n正文',
  '# 尾随空行\n\n\n',
  '段落\n\n\n\n间隔多个空行的段落\n',
  '', // 空文档
  '\n\n\n', // 全空行
  '---\ntitle: front matter\n---\n\n# 正文',
  '---\n含空行\n\n的 front matter\n---\n正文紧跟',
  '```js\nconst a = 1\n\nconst b = 2\n```\n\n围栏后正文',
  '段落被打断\n```python\nx = 1\n```\n紧接一行',
  '~~~~\n波浪围栏\n~~~\n内部短围栏不算闭合\n~~~~\n\n后文',
  '```\n无语言标注围栏\n```',
  '```js\nconst a = 1\n```', // 围栏即全文,无结尾换行
  'Setext 一级\n===\n\nSetext 二级\n---\n\n后文',
  '---\n\n水平线后正文',
  '- 列表项\n- 第二项\n- 第三项',
  '1. 有序\n2. 第二\n\n另一个列表',
  '> 引用行\n> 继续引用\n\n> 新引用块',
  '| a | b |\n| --- | ---: |\n| 1 | 2 |',
  '段落\r\nCRLF 换行风格\r\n\r\n第二段\r\n',
  '混合\n\r\n换行风格\r\n',
  '    缩进代码块\n    第二行\n\n后文',
  '```js\r\nconst a = 1\r\n```\r\n\r\nCRLF 围栏\r\n',
  '行内 `code` 与 **粗体** 混排\n\n第二段',
]

describe('splitBlocks / joinBlocks', () => {
  it('语料全量:切分后重组逐字节还原', () => {
    for (const content of CORPUS) {
      const blocks = splitBlocks(content)
      expect(joinBlocks(blocks), JSON.stringify(content)).toBe(content)
    }
  })

  it('围栏内的空行不切分(整块吞入)', () => {
    const blocks = splitBlocks('```\na\n\nb\n```\n\n后文')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toBe('```\na\n\nb\n```\n')
  })

  it('front matter 整体一块(含内部空行)', () => {
    const blocks = splitBlocks('---\na\n\nb\n---\n\n# x')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].text).toBe('---\na\n\nb\n---\n')
  })

  it('前导空行由伪块承载,偏移正确', () => {
    const blocks = splitBlocks('\n\n# a')
    expect(blocks[0]).toMatchObject({ from: 0, to: 0, text: '', separator: '\n\n' })
    expect(blocks[1].from).toBe(2)
  })

  it('separator 只含空行与换行,不含块内容', () => {
    for (const content of CORPUS) {
      for (const b of splitBlocks(content)) {
        expect(b.separator).toMatch(/^[ \t\r\n]*$/)
      }
    }
  })

  it('markDirty 命中区间内的块', () => {
    const blocks = splitBlocks('# a\n\n正文一\n\n正文二\n')
    const dirty = markDirty(blocks, 5, 8) // 命中「正文一」
    expect(dirty.map((b) => b.dirty)).toEqual([false, true, false])
    const none = markDirty(blocks, 0, 0)
    expect(none.every((b) => !b.dirty)).toBe(true)
  })
})
