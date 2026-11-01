import { describe, expect, it } from 'vitest'
import { reconcileBlocks, type BlockRuntime } from './reconcile-blocks'

/** 假节点:引用比较,t 为序列化文本 */
const N = (t: string) => ({ t })
const B = (text: string, separator: string, nodeCount: number): BlockRuntime => ({
  text,
  separator,
  dirty: false,
  nodeCount,
  pseudo: false,
})
const ser = (nodes: unknown[]) => nodes.map((n) => (n as { t: string }).t).join('')
const isEmptyP = (n: unknown) => (n as { t: string }).t === ''

describe('reconcileBlocks 归属 diff(P3 收紧)', () => {
  it('全部未动:引用一致,零脏,块表原样', () => {
    const a = N('a'), b = N('b')
    const blocks = [B('a\n', '\n', 1), B('b\n', '', 1)]
    const { blocks: out, owners } = reconcileBlocks(blocks, [0, 1], [a, b], [a, b], ser)
    expect(out.every((x) => !x.dirty)).toBe(true)
    expect(out.map((x) => x.text)).toEqual(['a\n', 'b\n'])
    expect(owners).toEqual([0, 1])
  })

  it('段中拆分关进同一个块,不外溢标脏相邻块', () => {
    const a = N('a'), b = N('b')
    const a1 = N('a1'), a2 = N('a2') // a 拆成两半(都非空)
    const blocks = [B('a\n', '\n', 1), B('b\n', '', 1)]
    const { blocks: out } = reconcileBlocks(blocks, [0, 1], [a, b], [a1, a2, b], ser, {
      isEmptyParagraph: () => false,
    })
    expect(out[0].dirty).toBe(true)
    expect(out[0].nodeCount).toBe(2)
    expect(out[0].dirtyText).toBe('a1a2\n')
    expect(out[1].dirty).toBe(false) // P3 前这里会被外溢标脏
    expect(out[1].text).toBe('b\n')
  })

  it('块首 Enter 拆出的空段归下一块', () => {
    const a = N('a'), b = N('b')
    const empty = N('')
    const blocks = [B('a\n', '\n', 1), B('b\n', '', 1)]
    const { blocks: out } = reconcileBlocks(blocks, [0, 1], [a, b], [a, empty, b], ser, {
      isEmptyParagraph: isEmptyP,
    })
    expect(out[0].dirty).toBe(false)
    expect(out[1].dirty).toBe(true)
    expect(out[1].nodeCount).toBe(2)
  })

  it('删除中间块:该块消失,前后保持', () => {
    const a = N('a'), b = N('b'), c = N('c')
    const blocks = [B('a\n', '\n', 1), B('b\n', '\n', 1), B('c\n', '', 1)]
    const { blocks: out } = reconcileBlocks(blocks, [0, 1, 2], [a, b, c], [a, c], ser)
    expect(out.map((x) => x.text)).toEqual(['a\n', 'c\n'])
    expect(out.every((x) => !x.dirty)).toBe(true)
  })

  it('空文档起笔:无主节点按 eol 合成新块,队尾不拖空行', () => {
    const x = N('x')
    const { blocks: out } = reconcileBlocks([], [], [], [x], ser, { eol: '\r\n' })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ text: 'x\r\n', separator: '', dirty: true, synthetic: true })
  })

  it('已脏块节点再变:dirtyText 重新生成', () => {
    const a = N('a')
    const a2 = N('a2')
    const blocks = [{ ...B('a\n', '', 1), dirty: true, dirtyText: '旧产物\n' }]
    const { blocks: out } = reconcileBlocks(blocks, [0], [a], [a2], ser)
    expect(out[0].dirtyText).toBe('a2\n')
  })
})
