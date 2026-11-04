/**
 * Front Matter 节点(P4c):`---\n…\n---` 整体一块,折叠为状态条。
 *
 * 保真修复:此前 front matter 被 markdown 语义解析为 hr+段落+hr,块内一旦
 * 编辑,序列化会插进空行(`---\n\ntitle…`)破坏 YAML 头形状。这里用自定义
 * tokenizer 把它解析成单一 code 型节点,renderMarkdown 原样吐回,
 * 编辑过的块也保持 `---\n…\n---` 形状。
 *
 * NodeView:默认折叠为「Front Matter · N 行」状态条;光标进入/节点选中时
 * 展开源码可编辑(与公式/mermaid 同一套,类由 tiptap-setup 的
 * SelectionEditingClass 插件按选区位置挂,NodeView 不自管类名)。
 */
import { Node, type Editor, type NodeViewRendererProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { ViewMutationRecord } from '@tiptap/pm/view'
import { clickToContent } from './nodeview-click'

function texOf(node: { content?: Array<{ text?: string }> }): string {
  return (node.content ?? []).map((c) => c.text ?? '').join('')
}

class FrontMatterView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private label: HTMLElement
  private node: PMNode

  constructor(node: PMNode, editor: Editor, getPos: () => number | undefined) {
    this.node = node
    this.dom = document.createElement('div')
    this.dom.className = 'live-frontmatter'
    this.label = document.createElement('span')
    this.label.className = 'live-frontmatter-label'
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'live-frontmatter-src'
    this.contentDOM.spellcheck = false
    this.dom.append(this.label, this.contentDOM)
    clickToContent(editor, getPos, this.dom, this.contentDOM)
    this.refresh()
  }

  private refresh(): void {
    const tex = texOf(this.node.toJSON())
    const lines = tex ? tex.split('\n').length : 0
    this.label.textContent = `⚙ Front Matter · ${lines} 行`
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.refresh()
    return true
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === 'selection') return true
    if (this.contentDOM.contains(mutation.target as HTMLElement)) return false
    return true
  }
}

export const FrontMatter = Node.create({
  name: 'frontMatter',
  group: 'block',
  content: 'text*',
  code: true,
  defining: true,

  parseMarkdown(token, h) {
    return h.createNode('frontMatter', undefined, [
      h.createTextNode((token as { tex?: string }).tex ?? ''),
    ])
  },
  renderMarkdown(node) {
    const tex = texOf(node).replace(/\n+$/, '')
    return `---\n${tex}\n---`
  },
  // 兜底 DOM 序列化:同 math-node,卸载期 nodeViews 清空后的重建依赖它
  renderHTML() {
    return ['div', { class: 'live-frontmatter' }, 0]
  },
  markdownTokenizer: {
    name: 'frontMatter',
    level: 'block',
    start: (src: string) => (src.startsWith('---\n') ? 0 : -1),
    tokenize(src: string) {
      // 只认文档/块首的 --- 开栏,闭合为单独的 --- 行(内部空行可含)
      const m = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(src)
      if (!m) return undefined
      return { type: 'frontMatter', raw: m[0], tex: m[1] }
    },
  },

  addNodeView() {
    return (props: NodeViewRendererProps) => new FrontMatterView(props.node, props.editor, props.getPos)
  },
})
