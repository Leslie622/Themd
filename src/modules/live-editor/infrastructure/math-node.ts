/**
 * 数学公式节点(infrastructure 层):块级 $$…$$ / 行内 $…$。
 *
 * - 文档模型:code 型文本节点(内容 = 原始 TeX,不经任何转义)
 * - 序列化:renderMarkdown 原样吐 `$$\n…\n$$` / `$…$`(P0 PoC 验证逐字节稳定)
 * - 解析:marked 自定义 tokenizer(块级/行内),货币 `$5` 等未闭合形式不误判
 * - NodeView:非选中态渲染 KaTeX;选中态(contentDOM)露 TeX 源码可编辑
 *   ——Typora 的聚焦显码交互,纯 CSS 态切换实现
 * - 预览/导出侧:@mdit/plugin-katex(markdown-renderer.ts),三面同源
 */
import { Node, type NodeViewRendererProps } from '@tiptap/core'
import type { ViewMutationRecord } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/** 节点里的原始 TeX(内容为纯 text 子节点) */
function texOf(node: { content?: Array<{ text?: string }> }): string {
  return (node.content ?? []).map((c) => c.text ?? '').join('')
}

function renderKatex(tex: string, displayMode: boolean, el: HTMLElement): void {
  try {
    el.innerHTML = katex.renderToString(tex, { throwOnError: false, displayMode })
  } catch {
    el.textContent = tex
    el.classList.add('live-math-error')
  }
}

/** 通用 NodeView:katex 渲染态 ↔ 选中态源码编辑(contentDOM) */
class MathView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private render: HTMLElement
  private node: PMNode
  private displayMode: boolean
  private selected = false

  constructor(node: PMNode, displayMode: boolean, className: string) {
    this.node = node
    this.displayMode = displayMode
    this.dom = document.createElement('div')
    this.dom.className = className
    this.render = document.createElement('span')
    this.render.className = 'live-math-render'
    this.contentDOM = document.createElement('span')
    this.contentDOM.className = 'live-math-src'
    this.contentDOM.spellcheck = false
    this.dom.append(this.render, this.contentDOM)
    this.refresh()
  }

  private refresh(): void {
    if (!this.selected) renderKatex(texOf(this.node.toJSON()), this.displayMode, this.render)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.refresh()
    return true
  }

  selectNode(): void {
    this.selected = true
    this.dom.classList.add('live-math-editing')
  }

  deselectNode(): void {
    this.selected = false
    this.dom.classList.remove('live-math-editing')
    this.refresh()
  }

  // katex 渲染区的 DOM 变化与 PM 无关;contentDOM 内的编辑正常放行
  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === 'selection') return true
    if (this.contentDOM.contains(mutation.target as HTMLElement)) return false
    return true
  }
}

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  content: 'text*',
  code: true,
  defining: true,

  parseMarkdown(token, h) {
    return h.createNode('mathBlock', undefined, [h.createTextNode((token as { tex?: string }).tex ?? '')])
  },
  renderMarkdown(node) {
    return `$$\n${texOf(node)}\n$$`
  },
  // 兜底 DOM 序列化:NodeView 缺席时(如 React 卸载期 setProps 清空
  // nodeViews 的重建)PM 走 spec.toDOM,缺了会抛 toDOM is not a function
  renderHTML() {
    return ['div', { class: 'live-math live-math-block' }, 0]
  },
  markdownTokenizer: {
    name: 'mathBlock',
    level: 'block',
    start: (src: string) => src.indexOf('$$'),
    tokenize(src: string) {
      const m = /^\$\$([\s\S]+?)\$\$(?:\n+|$)/.exec(src)
      if (!m) return undefined
      return {
        type: 'mathBlock',
        raw: m[0],
        tex: m[1].replace(/^\n+/, '').replace(/\n+$/, ''),
      }
    },
  },

  addNodeView() {
    return (props: NodeViewRendererProps) =>
      new MathView(props.node, true, 'live-math live-math-block')
  },
})

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  content: 'text*',
  inline: true,
  code: true,

  parseMarkdown(token, h) {
    return h.createNode('mathInline', undefined, [h.createTextNode((token as { tex?: string }).tex ?? '')])
  },
  renderMarkdown(node) {
    return `$${texOf(node)}$`
  },
  renderHTML() {
    return ['span', { class: 'live-math live-math-inline' }, 0]
  },
  markdownTokenizer: {
    name: 'mathInline',
    level: 'inline',
    start: (src: string) => src.indexOf('$'),
    tokenize(src: string) {
      const m = /^\$([^$\n]+?)\$(?!\d)/.exec(src)
      if (!m) return undefined
      return { type: 'mathInline', raw: m[0], tex: m[1] }
    },
  },

  addNodeView() {
    return (props: NodeViewRendererProps) =>
      new MathView(props.node, false, 'live-math live-math-inline')
  },
})
