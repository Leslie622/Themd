/**
 * GFM Alerts 提示块(infrastructure 层):`> [!NOTE]` 等标记引用块。
 *
 * - 文档模型:复用 blockquote 节点 + `alertType` 属性(不新增节点类型,
 *   schema/卸载兜底 toDOM/守门测试全部不受影响;普通引用完全走原路径)
 * - 解析:blockquote 首段为 [!TYPE] 标记时,吞掉标记、存 alertType;marked 把
 *   段内多行文本放在单个 text token 里,剥离即改它的 text
 * - 序列化:renderMarkdown 回写 `> [!TYPE]` 首行,正文行 `> ` 前缀与默认实现同构
 * - NodeView:仅 alertType 引用块渲染标题条(图标+类型名,复用静态侧的
 *   Octicon 与命名),普通引用返回 null 落回默认 DOM 渲染
 * - 静态/导出侧:markdown-renderer.ts 的 gfm-alerts 规则产出 .themd-callout,
 *   两侧共用同一套 --t-callout-* 主题令牌
 */
import Blockquote from '@tiptap/extension-blockquote'
import {
  mergeAttributes,
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
  type NodeViewRenderer,
  type NodeViewRendererProps,
} from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { ALERT_ICONS, ALERT_LABELS, type GfmAlertType } from '@/modules/rendering/gfm-alerts'

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

function iconSvg(type: GfmAlertType): string {
  return `<svg class="themd-callout-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="${ALERT_ICONS[type]}"></path></svg>`
}

/** 提示块 NodeView:标题条 + 内容区;alertType 变化时刷新类名与标题 */
class CalloutView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private node: PMNode
  private titleEl: HTMLElement

  constructor(node: PMNode) {
    this.node = node
    this.dom = document.createElement('div')
    this.titleEl = document.createElement('p')
    this.titleEl.className = 'themd-callout-title'
    this.contentDOM = document.createElement('div')
    this.dom.append(this.titleEl, this.contentDOM)
    this.refresh()
  }

  private refresh(): void {
    const type = this.node.attrs.alertType as GfmAlertType | null
    this.dom.className = type ? `themd-callout themd-callout-${type}` : 'themd-callout'
    if (type) {
      this.titleEl.innerHTML = `${iconSvg(type)}${ALERT_LABELS[type]}`
      this.titleEl.style.display = ''
    } else {
      this.titleEl.style.display = 'none'
    }
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.refresh()
    return true
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

  renderHTML({ node, HTMLAttributes }) {
    return [
      'blockquote',
      mergeAttributes(HTMLAttributes, node.attrs.alertType ? { 'data-alert': node.attrs.alertType as string } : {}),
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

  addNodeView() {
    // 普通引用返回 null 落回默认 DOM 渲染;提示块才有标题条
    // (PM 运行时支持 factory 返回 null,类型未建模,显式断言)
    return ((props: NodeViewRendererProps) =>
      props.node.attrs.alertType ? new CalloutView(props.node) : null) as NodeViewRenderer
  },
})
