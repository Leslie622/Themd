import { StateField, type EditorState, type Range, type Text } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import { ensureSyntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'

import { resolveImageSrcSync } from './image-src'

/**
 * 实时预览(实时渲染)装饰层:Typora/Obsidian 式「边写边渲染」。
 * 文档仍是纯 Markdown 源码,这里只做显示层装饰——语法树定位结构,
 * 隐藏语法标记、给渲染形态加样式类、整段标记换 widget:
 * - 标题:# 序列隐藏 + 行级字号字重(Setext 下划线行整行吞掉)
 * - 强调/删除线/行内代码:定界符隐藏,内文加样式类
 * - 链接:保留文本(链接样式),`[` 与 `](url)` 隐藏(URL 挂 title 悬停可看)
 * - 图片:整段标记换内联 <img>(src 经 resolveImageSrcSync 解析,与预览同源)
 * - 列表:无序标记换 bullet,有序标记置灰;任务标记换可点击 checkbox
 * - 引用:行级左边框,`>` 置灰;--- 整行换水平线;围栏代码块吞围栏行、
 *   内容行铺淡底
 * - 光标(或选区)压住的行一律露出源码,可正常编辑;平时 atomicRanges
 *   把光标/点击落点挡在隐藏区间外
 *
 * 与 image-decorator 同理必须用 StateField(state 层装饰),不能用
 * ViewPlugin:超长行的 LineGapWidget 压缩只统计 state 层装饰。
 * 本插件接管了图片标记的渲染,启用时须停用 image-decorator(二者都会
 * replace 同一图片标记范围,叠加冲突)——由 EditorPane 的 compartment 二选一。
 */

/** 任一选区与 [from, to] 有交集(空光标停在区间内也算) */
function selectionTouches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from)
}

/** 单行内非空白的下一个位置(列表标记后的空格,吞到内容起点) */
function skipSpaces(doc: Text, from: number, lineEnd: number): number {
  let to = from
  while (to < lineEnd && /\s/.test(doc.sliceString(to, to + 1))) to++
  return to
}

function isDelim(node: SyntaxNode | null): boolean {
  return node !== null && /Mark$/.test(node.name)
}

class InlineImageWidget extends WidgetType {
  readonly src: string
  readonly alt: string

  constructor(src: string, alt: string) {
    super()
    this.src = src
    this.alt = alt
  }

  eq(other: this) {
    return other.src === this.src && other.alt === this.alt
  }

  toDOM() {
    const img = document.createElement('img')
    img.className = 'cm-lp-img'
    img.src = resolveImageSrcSync(this.src)
    img.alt = this.alt
    if (this.alt) img.title = this.alt
    img.draggable = false
    return img
  }

  // 点击落点交给 CM:光标停到边界,所在行露源码可编辑
  ignoreEvent() {
    return false
  }
}

class TaskCheckboxWidget extends WidgetType {
  readonly checked: boolean
  readonly from: number
  readonly to: number

  constructor(checked: boolean, from: number, to: number) {
    super()
    this.checked = checked
    this.from = from
    this.to = to
  }

  eq(other: this) {
    return other.checked === this.checked && other.from === this.from && other.to === this.to
  }

  toDOM(view: EditorView) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.className = 'cm-lp-task'
    box.checked = this.checked
    // mousedown 不让给编辑器(避免抢焦点),click 改写文档 [ ] ↔ [x]
    box.addEventListener('mousedown', (e) => e.preventDefault())
    box.addEventListener('click', (e) => {
      e.preventDefault()
      view.dispatch({
        changes: { from: this.from, to: this.to, insert: this.checked ? '[ ]' : '[x]' },
      })
      view.focus()
    })
    return box
  }

  ignoreEvent() {
    return true
  }
}

class BulletWidget extends WidgetType {
  eq(other: this) {
    return other === this
  }

  toDOM() {
    const dot = document.createElement('span')
    dot.className = 'cm-lp-bullet'
    dot.textContent = '•'
    return dot
  }

  ignoreEvent() {
    return false
  }
}

class HorizontalRuleWidget extends WidgetType {
  eq(other: this) {
    return other === this
  }

  toDOM() {
    const hr = document.createElement('span')
    hr.className = 'cm-lp-hr'
    return hr
  }

  ignoreEvent() {
    return false
  }
}

type Push = (d: Range<Decoration>) => void

/** 行内容器(强调/删除线/行内代码):内文加样式类,光标不在行内时隐藏首尾定界符 */
function decorateInlineContainer(
  node: SyntaxNode,
  state: EditorState,
  doc: Text,
  push: Push,
  cls: string,
) {
  const fromLine = doc.lineAt(node.from)
  // 跨行的行内结构不做装饰,保守显示源码
  if (doc.lineAt(node.to).from !== fromLine.from) return
  const first = node.firstChild
  const last = node.lastChild
  if (!first || !isDelim(first) || !last || !isDelim(last)) return
  const innerTo = last !== first ? last.from : node.to
  if (first.to < innerTo) {
    push(Decoration.mark({ class: cls }).range(first.to, innerTo))
  }
  if (!selectionTouches(state, fromLine.from, fromLine.to)) {
    push(Decoration.replace({}).range(first.from, first.to))
    if (last !== first) push(Decoration.replace({}).range(last.from, last.to))
  }
}

/** 行内链接:保留文本(链接样式 + URL title),`[` 与 `](url)` 隐藏 */
function decorateLink(node: SyntaxNode, state: EditorState, doc: Text, push: Push) {
  const fromLine = doc.lineAt(node.from)
  if (doc.lineAt(node.to).from !== fromLine.from) return
  let open: SyntaxNode | null = null
  let closing: SyntaxNode | null = null
  let url: SyntaxNode | null = null
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.name === 'LinkMark') {
      if (!open) open = c
      else if (!closing) closing = c
    } else if (c.name === 'URL' && !url) {
      url = c
    }
  }
  if (!open || !closing) return
  const title = url ? doc.sliceString(url.from, url.to) : ''
  push(
    Decoration.mark({
      class: 'cm-lp-link',
      ...(title ? { attributes: { title } } : {}),
    }).range(open.to, closing.from),
  )
  if (!selectionTouches(state, fromLine.from, fromLine.to)) {
    push(Decoration.replace({}).range(open.from, open.to))
    if (closing.to < node.to) push(Decoration.replace({}).range(closing.from, node.to))
  }
}

/** 行内图片:整段标记换 <img>(光标压住时露源码) */
function decorateImage(node: SyntaxNode, state: EditorState, doc: Text, push: Push) {
  const fromLine = doc.lineAt(node.from)
  if (doc.lineAt(node.to).from !== fromLine.from) return
  let open: SyntaxNode | null = null
  let closing: SyntaxNode | null = null
  let url: SyntaxNode | null = null
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.name === 'LinkMark') {
      if (!open) open = c
      else if (!closing) closing = c
    } else if (c.name === 'URL' && !url) {
      url = c
    }
  }
  if (!open || !closing || !url) return
  if (selectionTouches(state, fromLine.from, fromLine.to)) return
  const alt = doc.sliceString(open.to, closing.from)
  const src = doc.sliceString(url.from, url.to)
  push(Decoration.replace({ widget: new InlineImageWidget(src, alt) }).range(node.from, node.to))
}

/** 行内结构的嵌套保护:强调套强调只由外层装饰,避免定界符 replace 区间重叠 */
function isInlineNested(node: SyntaxNode): boolean {
  const parent = node.parent
  return parent !== null && /^(Emphasis|StrongEmphasis|Strikethrough)$/.test(parent.name)
}

/** 最后一个指定名字的子节点(Setext 下划线等) */
function lastChildNamed(node: SyntaxNode, name: string): SyntaxNode | null {
  let found: SyntaxNode | null = null
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.name === name) found = c
  }
  return found
}

export function buildLiveDecorations(state: EditorState): DecorationSet {
  const { doc } = state
  const tree = ensureSyntaxTree(state, doc.length)
  if (!tree) return Decoration.none
  const decos: Range<Decoration>[] = []
  const push: Push = (d) => decos.push(d)

  tree.iterate({
    enter: (node) => {
      switch (node.name) {
        case 'ATXHeading1':
        case 'ATXHeading2':
        case 'ATXHeading3':
        case 'ATXHeading4':
        case 'ATXHeading5':
        case 'ATXHeading6': {
          const line = doc.lineAt(node.from)
          push(Decoration.line({ class: `cm-lp-h${node.name.slice(-1)}` }).range(line.from))
          if (selectionTouches(state, line.from, line.to)) break
          // 吞 `#+ ` 序列(行首缩进保留)
          const afterHashes = skipSpaces(
            doc,
            node.from + (doc.sliceString(node.from, line.to).match(/^#+/)?.[0].length ?? 0),
            line.to,
          )
          if (afterHashes > node.from) {
            push(Decoration.replace({}).range(node.from, afterHashes))
          }
          break
        }
        case 'SetextHeading1':
        case 'SetextHeading2': {
          const line = doc.lineAt(node.from)
          push(Decoration.line({ class: `cm-lp-h${node.name.slice(-1)}` }).range(line.from))
          const mark = lastChildNamed(node.node, 'HeaderMark')
          if (mark && !selectionTouches(state, mark.from, mark.to)) {
            push(Decoration.replace({}).range(mark.from, mark.to))
          }
          break
        }
        case 'Emphasis':
        case 'StrongEmphasis':
        case 'Strikethrough': {
          if (isInlineNested(node.node)) break
          const cls = node.name === 'StrongEmphasis' ? 'cm-lp-bold'
            : node.name === 'Strikethrough' ? 'cm-lp-strike'
              : 'cm-lp-italic'
          decorateInlineContainer(node.node, state, doc, push, cls)
          break
        }
        case 'InlineCode':
          decorateInlineContainer(node.node, state, doc, push, 'cm-lp-inline-code')
          break
        case 'Link':
          decorateLink(node.node, state, doc, push)
          break
        case 'Image':
          decorateImage(node.node, state, doc, push)
          break
        case 'ListMark': {
          const line = doc.lineAt(node.from)
          const mark = doc.sliceString(node.from, node.to)
          if (/^[*+-]$/.test(mark)) {
            if (!selectionTouches(state, line.from, line.to)) {
              const to = skipSpaces(doc, node.to, line.to)
              push(Decoration.replace({ widget: new BulletWidget() }).range(node.from, to))
            }
          } else {
            // 有序列表保留编号,仅置灰
            push(Decoration.mark({ class: 'cm-lp-listmark' }).range(node.from, node.to))
          }
          break
        }
        case 'TaskMarker': {
          // 任务框恒渲染(勾选是主要交互,光标进该行也不打断)
          const checked = /\[[xX]\]/.test(doc.sliceString(node.from, node.to))
          push(
            Decoration.replace({
              widget: new TaskCheckboxWidget(checked, node.from, node.to),
            }).range(node.from, node.to),
          )
          break
        }
        case 'BlockQuote': {
          for (let pos = node.from; pos <= node.to; ) {
            const line = doc.lineAt(pos)
            push(Decoration.line({ class: 'cm-lp-quote' }).range(line.from))
            if (line.to >= node.to) break
            pos = line.to + 1
          }
          break
        }
        case 'QuoteMark':
          push(Decoration.mark({ class: 'cm-lp-quotemark' }).range(node.from, node.to))
          break
        case 'FencedCode': {
          const openLine = doc.lineAt(node.from)
          const last = node.node.lastChild
          const closeLine =
            last && last.name === 'CodeMark' && last.from > openLine.from ? doc.lineAt(last.from) : null
          if (!selectionTouches(state, node.from, node.to)) {
            // 块级 replace 连换行一起吞,围栏行整行塌缩
            if (openLine.to + 1 <= doc.length) {
              push(Decoration.replace({ block: true }).range(openLine.from, openLine.to + 1))
            }
            if (closeLine && closeLine.from > openLine.to && closeLine.to + 1 <= doc.length) {
              push(Decoration.replace({ block: true }).range(closeLine.from, closeLine.to + 1))
            }
          }
          // 内容行铺淡底
          const contentEnd = closeLine ? closeLine.from : node.to
          for (let pos = openLine.to + 1; pos < contentEnd; ) {
            const line = doc.lineAt(pos)
            push(Decoration.line({ class: 'cm-lp-codeblock' }).range(line.from))
            if (line.to >= contentEnd) break
            pos = line.to + 1
          }
          break
        }
        case 'HorizontalRule': {
          const line = doc.lineAt(node.from)
          if (!selectionTouches(state, line.from, line.to) && line.to + 1 <= doc.length) {
            push(
              Decoration.replace({ block: true, widget: new HorizontalRuleWidget() })
                .range(line.from, line.to + 1),
            )
          }
          break
        }
      }
    },
  })
  return Decoration.set(decos, true)
}

const livePreviewField = StateField.define<DecorationSet>({
  create: (state) => buildLiveDecorations(state),
  update(_value, tr) {
    // 选区变化也要重算:光标压住的行露源码
    if (tr.docChanged || tr.selection) return buildLiveDecorations(tr.state)
    return _value
  },
  provide: (field) => EditorView.decorations.from(field),
})

// 隐藏区间原子化:方向键/点击落点整体跳过
const livePreviewAtomicRanges = EditorView.atomicRanges.of((view) =>
  view.state.field(livePreviewField, false) ?? Decoration.none,
)

const livePreviewTheme = EditorView.theme({
  '.cm-lp-h1': { fontSize: '1.6em', fontWeight: 700, lineHeight: 1.45 },
  '.cm-lp-h2': { fontSize: '1.4em', fontWeight: 700, lineHeight: 1.45 },
  '.cm-lp-h3': { fontSize: '1.22em', fontWeight: 600 },
  '.cm-lp-h4': { fontSize: '1.08em', fontWeight: 600 },
  '.cm-lp-h5': { fontSize: '1em', fontWeight: 600 },
  '.cm-lp-h6': { fontSize: '0.95em', fontWeight: 600, color: 'var(--muted-foreground)' },
  '.cm-lp-bold': { fontWeight: 700 },
  '.cm-lp-italic': { fontStyle: 'italic' },
  '.cm-lp-strike': { textDecoration: 'line-through' },
  '.cm-lp-inline-code': {
    backgroundColor: 'var(--muted)',
    borderRadius: '4px',
    padding: '1px 4px',
    fontSize: '0.9em',
  },
  '.cm-lp-link': {
    color: 'var(--primary)',
    textDecoration: 'underline',
    textDecorationColor: 'color-mix(in oklch, var(--primary) 45%, transparent)',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
  '.cm-lp-quote': {
    borderLeft: '2px solid var(--border)',
    paddingLeft: '8px',
    color: 'color-mix(in oklch, var(--foreground) 80%, var(--muted-foreground))',
  },
  '.cm-lp-quotemark': { color: 'var(--muted-foreground)' },
  '.cm-lp-codeblock': {
    backgroundColor: 'color-mix(in oklch, var(--muted) 40%, transparent)',
  },
  '.cm-lp-listmark': { color: 'var(--muted-foreground)', fontWeight: 600 },
  '.cm-lp-bullet': { color: 'var(--muted-foreground)' },
  '.cm-lp-task': {
    accentColor: 'var(--primary)',
    verticalAlign: 'middle',
    margin: '0 4px 0 2px',
  },
  '.cm-lp-img': {
    maxWidth: '100%',
    maxHeight: '240px',
    display: 'inline-block',
    verticalAlign: 'middle',
    borderRadius: '6px',
  },
  '.cm-lp-hr': {
    display: 'block',
    borderTop: '1px solid var(--border)',
    margin: '10px 0',
  },
})

export function markdownLivePreview() {
  return [livePreviewTheme, livePreviewField, livePreviewAtomicRanges]
}
