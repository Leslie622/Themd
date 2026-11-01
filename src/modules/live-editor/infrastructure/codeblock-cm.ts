/**
 * 代码块内嵌 CodeMirror(Typora/Milkdown 同款做法,P4b)。
 *
 * - StarterKit 的 codeBlock 换成带 CM6 NodeView 的扩展(markdown 解析/
 *   序列化配置继承官方实现,围栏往返保真不受影响)
 * - 同步环防护:CM 键入 → dispatch PM 整节点替换;NodeView.update 收到
 *   自己刚写的节点时文本一致 → 不回写 CM(检测外源变更才同步)
 * - 语言高亮:@codemirror/language-data 按需异步加载,fence 的 info 串
 *   匹配(含别名);右上角语言标签展示
 * - 事件分离:CM DOM 内的事件全归 CM(stopEvent),节点边缘/标签归 PM
 */
import CodeBlock from '@tiptap/extension-code-block'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView as PMEditorView } from '@tiptap/pm/view'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { EditorView as CMEditorView, keymap } from '@codemirror/view'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'

/** 语言高亮 compartment(异步 load 完成后 reconfigure) */
const languageComp = new Compartment()

const cmTheme = CMEditorView.theme({
  '&': { fontSize: '0.92em' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.6',
  },
  '.cm-content': {
    padding: '2px 0',
    caretColor: 'var(--t-strong, var(--primary))',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { background: 'transparent' },
})

/** 按语言名(含别名)异步装载 CM 语法 */
function loadLanguage(name: string, cb: (ext: Extension) => void): void {
  const desc = LanguageDescription.matchLanguageName(languages, name, true)
  if (!desc) return
  desc.load().then((support) => cb(support.extension ?? support))
}

class CodeMirrorNodeView {
  dom: HTMLElement
  node: PMNode
  view: PMEditorView
  getPos: () => number | undefined
  cm: CMEditorView
  private label: HTMLElement
  private lang = ''

  constructor(props: NodeViewRendererProps) {
    this.node = props.node
    this.view = props.view
    this.getPos = props.getPos
    this.dom = document.createElement('pre')
    this.dom.className = 'live-codeblock'
    this.label = document.createElement('span')
    this.label.className = 'live-codeblock-lang'
    this.dom.appendChild(this.label)
    this.cm = new CMEditorView({
      state: EditorState.create({
        doc: this.node.textContent,
        extensions: [
          history(),
          CMEditorView.lineWrapping,
          cmTheme,
          languageComp.of([]),
          CMEditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            this.pushToPm()
          }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
        ],
      }),
    })
    this.dom.appendChild(this.cm.dom)
    this.syncLanguage()
  }

  /** CM 键入 → 整节点替换写回 PM(文本一致守卫在 update 里挡住回环) */
  private pushToPm(): void {
    const pos = this.getPos()
    if (typeof pos !== 'number') return
    const text = this.cm.state.doc.toString()
    const content = text ? this.view.state.schema.text(text) : undefined
    const next = this.node.type.create(this.node.attrs, content)
    this.view.dispatch(this.view.state.tr.replaceWith(pos, pos + this.node.nodeSize, next))
  }

  private syncLanguage(): void {
    const lang = (this.node.attrs.language as string | null)?.trim() ?? ''
    if (lang === this.lang) return
    this.lang = lang
    this.label.textContent = lang || 'text'
    loadLanguage(lang, (ext) => {
      if (lang !== this.lang) return // 期间又换了语言
      this.cm.dispatch({ effects: languageComp.reconfigure(ext) })
    })
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    const text = node.textContent
    if (text !== this.cm.state.doc.toString()) {
      // 外源变更(PM 侧 undo/命令改写):整档同步给 CM
      this.cm.dispatch({
        changes: { from: 0, to: this.cm.state.doc.length, insert: text },
      })
    }
    this.syncLanguage()
    return true
  }

  selectNode(): void {
    this.dom.classList.add('live-codeblock-selected')
  }

  deselectNode(): void {
    this.dom.classList.remove('live-codeblock-selected')
  }

  // CM DOM 内的事件交给 CM 自己;节点边缘(标签等)归 PM
  stopEvent(event: Event): boolean {
    return this.cm.dom.contains(event.target as Node)
  }

  // CM 自管 DOM,PM 不需观察
  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    this.cm.destroy()
  }
}

export const CodeBlockCm = CodeBlock.extend({
  addNodeView() {
    return (props: NodeViewRendererProps) => new CodeMirrorNodeView(props)
  },
})
