import { describe, expect, it } from 'vitest'
import { EditorSelection, EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { buildLiveDecorations, markdownLivePreview } from './markdown-live-preview'

/** 构建装饰集并摊平为 {from, to, class, widget, block} 列表 */
function decoList(doc: string, cursor?: number) {
  let state = EditorState.create({
    doc,
    // 与 EditorPane 同配置:markdownLanguage 含 GFM(任务列表/删除线)
    extensions: [markdown({ base: markdownLanguage }), markdownLivePreview()],
  })
  if (cursor !== undefined) {
    state = state.update({ selection: EditorSelection.single(cursor) }).state
  }
  const set = buildLiveDecorations(state)
  const out: { from: number; to: number; cls?: string; widget: boolean; block: boolean }[] = []
  const iter = set.iter()
  while (iter.value) {
    const spec = iter.value.spec as { class?: string; widget?: unknown; block?: boolean }
    out.push({
      from: iter.from,
      to: iter.to,
      cls: spec.class,
      widget: spec.widget !== undefined,
      block: spec.block === true,
    })
    iter.next()
  }
  return out
}

const replacesOf = (list: ReturnType<typeof decoList>, from: number, to: number) =>
  list.filter((d) => d.from === from && d.to === to && !d.cls)

describe('markdown-live-preview', () => {
  it('光标不在标题行时吞掉 `# ` 并给行加大标题类', () => {
    const list = decoList('# Title\n\nbody', 13)
    expect(replacesOf(list, 0, 2)).toHaveLength(1)
    expect(list.some((d) => d.cls === 'cm-lp-h1' && d.from === 0)).toBe(true)
  })

  it('光标压住标题行时露出源码(仅保留行级样式)', () => {
    const list = decoList('# Title', 4)
    expect(list.filter((d) => !d.cls && !d.widget)).toHaveLength(0)
    expect(list.some((d) => d.cls === 'cm-lp-h1')).toBe(true)
  })

  it('粗体定界符隐藏、内文加样式类', () => {
    const list = decoList('a **b** c\n\nx', 11)
    expect(replacesOf(list, 2, 4)).toHaveLength(1)
    expect(replacesOf(list, 5, 7)).toHaveLength(1)
    expect(list.some((d) => d.cls === 'cm-lp-bold' && d.from === 4 && d.to === 5)).toBe(true)
  })

  it('图片标记整段换内联 widget', () => {
    const list = decoList('![alt](a.png)\n\nx', 16)
    const hit = replacesOf(list, 0, 13)
    expect(hit).toHaveLength(1)
    expect(hit[0].widget).toBe(true)
  })

  it('任务框恒渲染(光标在行内也可勾选)', () => {
    const list = decoList('- [x] done', 5)
    const hit = replacesOf(list, 2, 5)
    expect(hit).toHaveLength(1)
    expect(hit[0].widget).toBe(true)
  })

  it('围栏代码块吞围栏行、内容行铺淡底', () => {
    const list = decoList('```js\nlet a = 1\n```\nafter', 24)
    expect(list.some((d) => d.block && d.from === 0 && d.to === 6)).toBe(true)
    expect(list.some((d) => d.block && d.from === 16 && d.to === 20)).toBe(true)
    expect(list.some((d) => d.cls === 'cm-lp-codeblock' && d.from === 6)).toBe(true)
  })
})
