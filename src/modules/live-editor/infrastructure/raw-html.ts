/**
 * 内嵌 HTML 保真节点(渲染统一方案 §6.2 解析保真政策①,2026-11-03 拍板)。
 *
 * schema 不认识的块级/行内 HTML 原样进文档流,序列化逐字节吐回。
 *
 * - 解析:接管 marked 的 html token(markdownTokenName 'html' 优先于 manager
 *   内置的 parseHTMLToken——后者在浏览器里 generateJSON 进 schema、node 里
 *   降级字面文本,两环境行为分叉;统一由本节点收编,html 恒为原文)。
 * - 编辑器 DOM:源码形态展示(pre>code / 行内 code),内容不注入 DOM
 *   (I4 编辑镀层原则;所见即所得的完整呈现属执行路径第 4 步编辑面拉平)。
 * - 静态渲染:verbatim 透传(rendering/golden/static-html 特例),
 *   与 markdown-it html:true 字节一致。
 */
import { Node, type MarkdownToken } from '@tiptap/core'

const rawOf = (token: MarkdownToken): string =>
  ((token as { raw?: string }).raw ?? (token as { text?: string }).text ?? '').toString()

export const RawHtmlBlock = Node.create({
  name: 'rawHtmlBlock',
  group: 'block',
  atom: true,
  isolating: true,

  addAttributes() {
    return { html: { default: '' } }
  },

  renderHTML({ node }) {
    return ['pre', { 'data-raw-html': '' }, ['code', {}, (node.attrs.html as string) ?? '']]
  },

  // html token 同时覆盖块级与行内(marked 里两者 type 都是 'html'),
  // 块级落本节点、行内落 rawHtmlInline
  markdownTokenName: 'html',
  parseMarkdown: (token: MarkdownToken) => {
    const html = rawOf(token)
    if (!html.trim()) return []
    return (token as { block?: boolean }).block
      ? { type: 'rawHtmlBlock', attrs: { html } }
      : { type: 'rawHtmlInline', attrs: { html } }
  },
  renderMarkdown: (node) => node.attrs?.html ?? '',
})

export const RawHtmlInline = Node.create({
  name: 'rawHtmlInline',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { html: { default: '' } }
  },

  renderHTML({ node }) {
    return ['code', { 'data-raw-html-inline': '' }, (node.attrs.html as string) ?? '']
  },

  /**
   * 词法层接管行内标签:manager 对「跨 token 的开闭标签对」有内置合并路径
   * (直呼 parseHTMLToken,绕过 markdownTokenName handler,且浏览器/node
   * 行为分叉)——在 marked 产 token 之前就收编,合并路径永不触发。
   * 角括号自动链接(<https://…>)不抢,归 marked 原生规则。
   */
  markdownTokenizer: {
    name: 'rawHtmlInlineTag',
    level: 'inline',
    start(src: string) {
      return src.search(/<[a-zA-Z/!]/)
    },
    tokenize(src: string) {
      const m = /^<[a-zA-Z/!][^<>]*>/.exec(src)
      if (!m) return undefined
      if (/^<https?:\/\//i.test(m[0]) || /^<mailto:/i.test(m[0])) return undefined
      return { type: 'rawHtmlInlineTag', raw: m[0] }
    },
  },
  markdownTokenName: 'rawHtmlInlineTag',
  parseMarkdown: (token: MarkdownToken) => {
    const html = rawOf(token)
    return html ? { type: 'rawHtmlInline', attrs: { html } } : []
  },
  renderMarkdown: (node) => node.attrs?.html ?? '',
})
