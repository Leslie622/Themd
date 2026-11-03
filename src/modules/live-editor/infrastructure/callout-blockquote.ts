/**
 * GFM Alerts 提示块(infrastructure 层):`> [!NOTE]` 等标记引用块。
 *
 * - 文档模型:复用 blockquote 节点 + `alertType` 属性(不新增节点类型,
 *   守门测试不受影响;普通引用完全走原路径)
 * - 解析:blockquote 首段为 [!TYPE] 标记时,吞掉标记、存 alertType;marked 把
 *   段内多行文本放在单个 text token 里,剥离即改它的 text
 * - 序列化:renderMarkdown 回写 `> [!TYPE]` 首行,正文行 `> ` 前缀与默认实现同构
 * - 编辑面(第 4 步拉平):renderHTML 直出规范结构 div.themd-callout +
 *   标题行(静态 spec 子节点,不可编辑,字节与静态侧 gfm-alerts 同源)+
 *   内容洞——NodeView 整体退役,编辑面/预览/导出同构(theme-base 的
 *   .themd-callout > * 子选择器两侧同样命中)
 */
import Blockquote from '@tiptap/extension-blockquote'
import {
  mergeAttributes,
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
} from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { titleInnerHtml, type GfmAlertType } from '@/modules/rendering/gfm-alerts'

const ALERT_MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:\n|$)/

/** marked 的 blockquote token:首段标记时返回类型 */
function alertTypeOf(token: MarkdownToken): GfmAlertType | null {
  const first = token.tokens?.[0]
  if (first?.type !== 'paragraph') return null
  const m = ALERT_MARKER_RE.exec(first.text ?? '')
  return m ? (m[1].toLowerCase() as GfmAlertType) : null
}

/**
 * 原地剥离首段标记行,正文保留在原段(与静态侧 gfm-alerts 的 hasRest 语义一致):
 * 标记独占段落 → 整段移除;标记+正文同段 → 正文留作首段正文。
 * breaks:true 下 marked 把段内换行拆成 text('[!NOTE]') + br 两个 token,
 * 标记行剥除必须连 br 一起删,否则正文前残留 <br>(两种形态都处理)。
 */
function stripMarker(token: MarkdownToken): void {
  const first = token.tokens?.[0]
  if (!first) return
  // 标记独占段落:整段从 children 移除
  if (!first.text?.replace(ALERT_MARKER_RE, '').trim()) {
    token.tokens = token.tokens?.slice(1)
    return
  }
  const inlines = first.tokens ?? []
  const head = inlines[0]
  if (head?.type === 'text' && head.text && ALERT_MARKER_RE.test(head.text)) {
    // breaks:true 形态:独立 text 恰为标记行,紧随 br → 连 br 一起删
    if (!head.text.replace(ALERT_MARKER_RE, '').trim() && inlines[1]?.type === 'br') {
      first.tokens = inlines.slice(2)
      return
    }
    head.text = head.text.replace(ALERT_MARKER_RE, '')
    head.raw = head.raw?.replace(ALERT_MARKER_RE, '')
    return
  }
  // breaks:false 兜底:单 text token 含 \n,剥掉标记行
  if (head?.type === 'text') {
    head.text = head.text?.replace(ALERT_MARKER_RE, '')
    head.raw = head.raw?.replace(ALERT_MARKER_RE, '')
  }
}

export const CalloutBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alertType: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-alert'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.alertType ? { 'data-alert': attrs.alertType as string } : {},
      },
    }
  },

  parseHTML() {
    return [
      ...(this.parent?.() ?? [{ tag: 'blockquote' }]),
      {
        // 规范结构的粘贴往返:div.themd-callout 解析回提示块;
        // 标题行不是内容(装饰注入),contentElement 里排除——PM 的
        // contentElement 类型只认单元素,Fragment 需断言(运行时按节点集合读)
        tag: 'div.themd-callout',
        contentElement: (el: HTMLElement) => {
          const frag = el.ownerDocument.createDocumentFragment()
          for (const child of [...el.children]) {
            if (!child.classList.contains('themd-callout-title')) frag.append(child)
          }
          return frag as unknown as HTMLElement
        },
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.alertType as GfmAlertType | null
    if (!type) return ['blockquote', mergeAttributes(HTMLAttributes), 0]
    // spec 只出壳(内容洞独占);标题行见 calloutTitleKey 装饰(首子前注入,
    // DOM 与静态侧规范结构逐同:div.themd-callout > p.themd-callout-title + 正文)
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `themd-callout themd-callout-${type}`,
        'data-alert': type,
      }),
      0,
    ]
  },

  parseMarkdown(token: MarkdownToken, h: MarkdownParseHelpers) {
    const parseChildren = h.parseBlockChildren ?? h.parseChildren
    const type = alertTypeOf(token)
    if (!type) {
      // 普通引用:与默认实现同构
      return h.createNode('blockquote', undefined, parseChildren(token.tokens ?? []))
    }
    stripMarker(token)
    return h.createNode('blockquote', { alertType: type }, parseChildren(token.tokens ?? []))
  },

  renderMarkdown(node: JSONContent, h: MarkdownRendererHelpers): string {
    // 序列化传 JSON 节点,attrs 可缺省
    const type = node.attrs?.alertType as string | null | undefined
    if (!node.content?.length) {
      return type ? `> [!${type.toUpperCase()}]` : ''
    }
    // 与默认 blockquote 序列化同构:子块各自加前缀,子块之间插 `>` 空行
    const groups: string[] = []
    node.content.forEach((child, index) => {
      const rendered = h.renderChild?.(child, index) ?? h.renderChildren([child])
      groups.push(
        rendered
          .split('\n')
          .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
          .join('\n'),
      )
    })
    const body = groups.join('\n>\n')
    return type ? `> [!${type.toUpperCase()}]\n${body}` : body
  },

  addProseMirrorPlugins() {
    const typeName = this.name
    const build = (doc: PMNode): DecorationSet => {
      const widgets: Decoration[] = []
      doc.descendants((node, pos) => {
        if (node.type.name !== typeName) return
        const type = node.attrs.alertType as GfmAlertType | null
        if (!type || !node.firstChild) return
        // 首子之前(div 开头):标题行成为 .themd-callout 的第一个子元素,
        // theme-base 的 .themd-callout > * / > * + * 选择器与静态侧同样命中
        widgets.push(
          Decoration.widget(
            pos + 1,
            () => {
              const p = document.createElement('p')
              p.className = 'themd-callout-title'
              p.contentEditable = 'false'
              p.innerHTML = titleInnerHtml(type)
              return p
            },
            { side: -1 },
          ),
        )
      })
      return DecorationSet.create(doc, widgets)
    }
    const key = new PluginKey<DecorationSet>('canonicalCalloutTitle')
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => build(state.doc),
          apply: (tr, value, _old, newState) =>
            tr.docChanged ? build(newState.doc) : value.map(tr.mapping, newState.doc),
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ]
  },
})
