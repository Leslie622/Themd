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
import type { Editor, NodeViewRendererProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView as PMEditorView, ViewMutationRecord } from '@tiptap/pm/view'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { EditorView as CMEditorView, keymap } from '@codemirror/view'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { HighlightStyle, LanguageDescription, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { languages } from '@codemirror/language-data'

import { useAppearance } from '@/store-appearance'
import { useEditorPrefs } from '@/store-editor'
import { renderMermaidSvg } from './mermaid-render'
import { clickToContent } from './nodeview-click'
import { buildCodeButtons } from '@/modules/rendering/codeblock-chrome'
import { displayLanguage } from '@/modules/rendering/code-highlight'
import { languageIconSvg } from '@/modules/rendering/language-icon-svg'
import { mountLanguagePicker } from './language-picker-mount'

/** 语言高亮 compartment(异步 load 完成后 reconfigure) */
const languageComp = new Compartment()

/**
 * 字体/字号/行高吃主题令牌,与 theme-base 的 pre code 同一套 --t-code-*。
 * '&.cm-editor' 把特异性抬到 0-2-0:index.css 里 v1 全文编辑器的
 * `.cm-editor { font-size: var(--font-editor-size) }`(分屏/纯编辑视图仍在用,
 * 该规则不退役)会无差别命中代码块内嵌 CM,劫持主题字号——2026-11-03
 * 样式守门 harness 量出 13.5px vs 14px 的根因。回落链与 theme-base
 * `pre code` 逐字同源(双字体改造后的现链)。
 */
const cmTheme = CMEditorView.theme({
  '&.cm-editor': { fontSize: 'var(--t-code-size, 0.875em)' },
  '.cm-scroller': {
    fontFamily: "var(--t-code-font, ui-monospace, 'Cascadia Mono', Consolas, monospace)",
    lineHeight: 'var(--t-code-leading, 1.6)',
  },
  '.cm-content': {
    padding: '2px 0',
    caretColor: 'var(--t-strong-color, var(--primary))',
    // 静态 pre>code 不折行(overflow-x 滚动);CM 基座只设 white-space-collapse
    // 长手,text-wrap-mode 落在初始值 wrap 会折行——换行交给 wrapComp 动态
    // 装 CMEditorView.lineWrapping + theme-base 的 .themd-code-wrap(见下)。
    // (注意 CM 的属性序列化:textWrap 会被写成 text-wrap-style,须用精确长手名)
    whiteSpaceCollapse: 'preserve',
    textWrapMode: 'nowrap',
  },
  '.cm-gutters': { display: 'none' },
  '.cm-activeLine': { background: 'transparent' },
})

/** 代码高亮色板:对齐预览侧 highlight.js 的 github.css(亮色;预览不随暗色切换,live 保持同观感) */
const githubHighlight = HighlightStyle.define([
  { tag: [t.definition(t.variableName), t.function(t.variableName)], color: '#8250df' },
  { tag: [t.comment, t.meta, t.processingInstruction], color: '#6e7781' },
  { tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.moduleKeyword], color: '#cf222e' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#0a3069' },
  { tag: [t.number, t.bool, t.null, t.atom], color: '#0550ae' },
  { tag: [t.className, t.typeName], color: '#953800' },
  { tag: [t.propertyName, t.attributeName], color: '#0550ae' },
  { tag: t.tagName, color: '#116329' },
])

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
  private header: HTMLElement
  private langText: HTMLElement
  private pre: HTMLElement
  /** 已同步进 header 的语言;langSynced=false 表示尚未同步过(首帧无语言块也必须执行一次) */
  private lang = ''
  private langSynced = false
  /** 换行临时态 compartment(header 按钮切换,不持久化) */
  private wrapComp = new Compartment()
  /** 语言选择浮层卸载函数(开着时非 null) */
  private pickerUnmount: (() => void) | null = null

  constructor(props: NodeViewRendererProps) {
    this.node = props.node
    this.view = props.view
    this.getPos = props.getPos
    // 规范包装(契约 §3 本家形态):div.themd-code > header 行 + pre>CM。
    // header 是 NodeView 镀层 DOM,不进文档模型;pre.live-codeblock 类名
    // 保留——theme-base 的 pre 令牌规则与 harness 跨侧配对都靠它命中。
    this.dom = document.createElement('div')
    this.dom.className = 'themd-code live-codeblock-wrapper'
    this.header = document.createElement('div')
    this.header.className = 'themd-code-lang'
    this.langText = document.createElement('span')
    this.langText.className = 'themd-code-lang-name'
    // 语言文本可点击 → 语言选择浮层;mousedown preventDefault 防焦点抢夺
    this.langText.addEventListener('mousedown', (e) => e.preventDefault())
    this.langText.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.openLanguagePicker()
    })
    this.header.appendChild(this.langText)
    this.dom.appendChild(this.header)
    this.pre = document.createElement('pre')
    this.pre.className = 'live-codeblock'
    this.dom.appendChild(this.pre)
    const prefs = useEditorPrefs.getState()
    // 按钮区(交互层,应用内注入):复制 + 换行,随偏好可关
    this.header.appendChild(
      buildCodeButtons(
        {
          onToggleWrap: (wrapped) => {
            this.setWrapped(wrapped)
          },
        },
        {
          copyButton: prefs.codeCopyButtonEnabled,
          wrapButton: prefs.codeWrapButtonEnabled,
        },
      ),
    )
    this.cm = new CMEditorView({
      state: EditorState.create({
        doc: this.node.textContent,
        extensions: [
          history(),
          // 不开 lineWrapping:静态代码块不换行(overflow-x 滚动),两侧同观感;
          // header 换行按钮经 wrapComp 动态装载(临时态,刷新回默认)
          cmTheme,
          this.wrapComp.of([]),
          syntaxHighlighting(githubHighlight),
          languageComp.of([]),
          CMEditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            this.pushToPm()
          }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
        ],
      }),
    })
    this.pre.appendChild(this.cm.dom)
    this.syncLanguage()
  }

  /** 换行临时态:CM 折行 + 容器类(静态面同款规则)双开 */
  private setWrapped(wrapped: boolean): void {
    this.cm.dispatch({
      effects: this.wrapComp.reconfigure(wrapped ? CMEditorView.lineWrapping : []),
    })
    this.dom.classList.toggle('themd-code-wrap', wrapped)
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
    if (this.langSynced && lang === this.lang) return
    this.lang = lang
    this.langSynced = true
    // 语言标签 = 图标(官方品牌 SVG,与规范 HTML 同源)+ 文本;header 子节点
    // (图标 svg/文本/浮层锚点)各自独立更新互不清除——textContent 会杀掉
    // 浮层锚点,Radix 立即把浮层重定位到左上角=闪角 bug。
    // 无语言恒为 text 且无图标。文本可点击 → 语言选择浮层(选完
    // setNodeMarkup 写回,切到 mermaid 时 update 返回 false 让 PM 重建图表视图)
    const iconSvg = languageIconSvg(lang)
    // 图标 svg 放 header 直接子(与静态面 .themd-code-lang > svg 同构),换语言整只替换
    this.header.querySelectorAll(':scope > svg').forEach((el) => el.remove())
    if (iconSvg) this.langText.insertAdjacentHTML('beforebegin', iconSvg)
    let textNode = this.langText.firstChild
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      this.langText.textContent = ''
      textNode = document.createTextNode('')
      this.langText.insertBefore(textNode, this.langText.firstChild)
    }
    textNode.textContent = displayLanguage(lang)
    loadLanguage(lang, (ext) => {
      if (lang !== this.lang) return // 期间又换了语言
      this.cm.dispatch({ effects: languageComp.reconfigure(ext) })
    })
  }

  /** 语言文本点击 → 弹出语言选择浮层(shadcn Popover+Command) */
  private openLanguagePicker(): void {
    if (this.pickerUnmount) return // 已开着
    this.pickerUnmount = mountLanguagePicker(
      this.langText,
      (next) => {
        const pos = this.getPos()
        if (typeof pos !== 'number') return
        this.view.dispatch(
          this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.node.attrs,
            language: next,
          }),
        )
      },
      // 浮层关闭(选择/点外/Esc)即清引用,否则第二次点击被「已开着」守卫挡住
      () => {
        this.pickerUnmount = null
      },
    )
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    // 语言切到 mermaid → 返回 false 让 PM 重建为图表视图
    if ((node.attrs.language as string)?.toLowerCase() === 'mermaid') return false
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

  // CM DOM 内的事件交给 CM 自己;header 按钮(不在 cm.dom 内)自带
  // preventDefault 处理也归自己;其余节点边缘归 PM
  stopEvent(event: Event): boolean {
    const target = event.target as Node
    if (this.header.contains(target)) return true
    return this.cm.dom.contains(target)
  }

  // CM 自管 DOM,PM 不需观察
  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    this.pickerUnmount?.()
    this.cm.destroy()
  }
}

/** mermaid 图表视图:非选中渲染 SVG,选中显源码(原生 contentDOM 编辑,PM 直管文本) */
class MermaidNodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private svgHost: HTMLElement
  private node: PMNode
  private selected = false
  private lastText = ''

  constructor(node: PMNode, editor: Editor, getPos: () => number | undefined) {
    this.node = node
    this.dom = document.createElement('div')
    // 挂规范类 .themd-mermaid(居中/限宽吃 theme-base,与预览/导出同源)
    this.dom.className = 'themd-mermaid live-mermaid'
    this.svgHost = document.createElement('div')
    this.svgHost.className = 'live-mermaid-svg'
    this.contentDOM = document.createElement('div')
    this.contentDOM.className = 'live-mermaid-src'
    this.contentDOM.spellcheck = false
    this.dom.append(this.svgHost, this.contentDOM)
    clickToContent(editor, getPos, this.dom, this.contentDOM)
    this.refresh()
  }

  private refresh(): void {
    const text = this.node.textContent
    if (this.selected || text === this.lastText) return
    this.lastText = text
    renderMermaidSvg(text, useAppearance.getState().isDark)
      .then((svg) => {
        if (!this.selected) this.svgHost.innerHTML = svg
      })
      .catch(() => {
        this.svgHost.textContent = text
        this.svgHost.classList.add('live-mermaid-error')
      })
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    if ((node.attrs.language as string)?.toLowerCase() !== 'mermaid') return false
    this.node = node
    this.refresh()
    return true
  }

  // selected 只冻结渲染;光标进内容的展开类由 SelectionEditingClass 插件挂
  // (tiptap-setup),NodeView 不自管类名
  selectNode(): void {
    this.selected = true
  }

  deselectNode(): void {
    this.selected = false
    this.lastText = '' // 强制重渲染(源码可能已改)
    this.refresh()
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    if (mutation.type === 'selection') return true
    if (this.contentDOM.contains(mutation.target as HTMLElement)) return false
    return true
  }
}

export const CodeBlockCm = CodeBlock.extend({
  addNodeView() {
    return (props: NodeViewRendererProps) => {
      // mermaid fence → 图表视图;其余语言 → CM 视图
      if ((props.node.attrs.language as string)?.toLowerCase() === 'mermaid') {
        return new MermaidNodeView(props.node, props.editor, props.getPos)
      }
      return new CodeMirrorNodeView(props)
    }
  },
})
