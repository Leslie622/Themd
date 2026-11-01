/**
 * 实时编辑器的右键菜单/快捷键命令层(application 层,PM 版 markdown-commands)。
 * 语义对齐 src/lib/markdown-commands.ts(CM 版),交互模型差异处:
 * - 行内格式走 mark(toggleBold/toggleCode…),空选区时由 PM 扩展语义处理
 * - 链接:有选中 → toggleLink(占位 url);已在链接上 → 解除链接
 *   (P5 做链接编辑对话框)
 * - 粘贴的 markdown 文本解析后插入(Typora 式,粘贴即渲染)
 * - 脚注/链接引用/YAML Front Matter/[TOC] 依赖自定义节点(P4 折叠块/
 *   脚注节点),先不提供——强插纯文本会被序列化器转义,破坏源码形状
 */
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'

import { renderMarkdown } from '@/modules/rendering/markdown-renderer'
import { simplifyMarkdown } from '@/lib/markdown-commands'
import { getMarkdownManager, parseBlockMarkdown } from '../infrastructure/markdown-engine'

/** 把 markdown 文本解析成节点插入光标处(Typora 式:插入即渲染) */
export function insertMarkdown(editor: Editor, markdown: string): void {
  const content = parseBlockMarkdown(markdown).content
  if (!content || content.length === 0) return
  editor.chain().focus().insertContent(content).run()
}

// ── 行内格式 ────────────────────────────────────────────────────────

export function toggleBold(editor: Editor): void {
  editor.chain().focus().toggleBold().run()
}

export function toggleItalic(editor: Editor): void {
  editor.chain().focus().toggleItalic().run()
}

export function toggleInlineCode(editor: Editor): void {
  editor.chain().focus().toggleCode().run()
}

/** 链接:选中文字 → 加链接(占位 url);已在链接上 → 解除 */
export function insertLink(editor: Editor): void {
  const { state } = editor
  const { from, empty } = state.selection
  if (!empty) {
    const linked = state.doc.resolve(from).marks().some((m) => m.type.name === 'link')
    const chain = editor.chain().focus()
    if (linked) chain.unsetLink().run()
    else chain.toggleLink({ href: 'url' }).run()
    return
  }
  // 空选区:插入「链接文本」并把光标选在文本上待改
  const json = parseBlockMarkdown('[链接文本](url)').content
  if (!json) return
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const schema = tr.doc.type.schema
      const at = tr.selection.from
      tr.insert(at, json.map((n) => schema.nodeFromJSON(n)))
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + 1)))
      return true
    })
    .run()
}

// ── 块级格式 ────────────────────────────────────────────────────────

export function toggleQuote(editor: Editor): void {
  editor.chain().focus().toggleBlockquote().run()
}

export function toggleBulletList(editor: Editor): void {
  editor.chain().focus().toggleBulletList().run()
}

export function toggleOrderedList(editor: Editor): void {
  editor.chain().focus().toggleOrderedList().run()
}

export function toggleTaskList(editor: Editor): void {
  editor.chain().focus().toggleTaskList().run()
}

/** 标题层级:0 = 转回普通段落 */
export function setHeading(editor: Editor, level: 0 | 1 | 2 | 3 | 4 | 5 | 6): void {
  const chain = editor.chain().focus()
  if (level === 0) chain.setParagraph().run()
  else chain.toggleHeading({ level }).run()
}

export function insertCodeBlock(editor: Editor): void {
  editor.chain().focus().setCodeBlock().run()
}

export function insertTable(editor: Editor): void {
  editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
}

export function insertHorizontalRule(editor: Editor): void {
  editor.chain().focus().setHorizontalRule().run()
}

/** 公式块:$$ 围栏两段(P4 公式节点前以纯段落形态保住源码形状) */
export function insertMathBlock(editor: Editor): void {
  insertMarkdown(editor, '$$\n\n$$')
}

/** 当前顶层块的标题层级(菜单打勾用);非标题 = 0 */
export function currentHeadingLevel(editor: Editor): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const parent = editor.state.selection.$from.parent
  return parent.type.name === 'heading' ? ((parent.attrs.level as 1 | 2 | 3 | 4 | 5 | 6) ?? 0) : 0
}

/** 选区是否为空(剪贴板项禁用态用) */
export function selectionEmpty(editor: Editor): boolean {
  return editor.state.selection.empty
}

// ── 段落插入 ────────────────────────────────────────────────────────

function insertEmptyParagraph(editor: Editor, where: 'above' | 'below'): void {
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      const { $from } = tr.selection
      const anchor = where === 'above' ? $from.before(1) : $from.after(1)
      const paragraph = tr.doc.type.schema.nodes.paragraph.create()
      tr.insert(anchor, paragraph)
      // 新段落的第一个光标位(anchor+1):上方插入光标进新段,下方同理
      tr.setSelection(TextSelection.near(tr.doc.resolve(anchor + 1)))
      return true
    })
    .run()
}

export function insertParagraphAbove(editor: Editor): void {
  insertEmptyParagraph(editor, 'above')
}

export function insertParagraphBelow(editor: Editor): void {
  insertEmptyParagraph(editor, 'below')
}

// ── 剪贴板 ─────────────────────────────────────────────────────────

/** 选区文本(块间以空行连接) */
function selectedText(editor: Editor): string {
  const { from, to } = editor.state.selection
  return editor.state.doc.textBetween(from, to, '\n\n')
}

export function copySelection(editor: Editor): Promise<void> {
  const text = selectedText(editor)
  if (!text) return Promise.resolve()
  return navigator.clipboard.writeText(text).catch(() => {
    toastCopyError()
  })
}

export function cutSelection(editor: Editor): Promise<void> {
  const text = selectedText(editor)
  if (!text) return Promise.resolve()
  return navigator.clipboard
    .writeText(text)
    .then(() => {
      editor.chain().focus().deleteSelection().run()
    })
    .catch(() => toastCopyError())
}

/** 粘贴剪贴板文本,markdown 解析后插入(粘贴即渲染,Typora 式) */
export function pasteClipboard(editor: Editor): Promise<void> {
  return navigator.clipboard
    .readText()
    .then((text) => {
      if (text) insertMarkdown(editor, text)
      editor.commands.focus()
    })
    .catch(() => {
      // readText 权限被拒(常见于 WebView),回落浏览器原生粘贴
      document.execCommand('paste')
      editor.commands.focus()
    })
}

/** 粘贴为纯文本(不解析 markdown) */
export function pasteAsPlainText(editor: Editor): Promise<void> {
  return navigator.clipboard
    .readText()
    .then((text) => {
      if (text) editor.chain().focus().command(({ tr }) => (tr.insertText(text), true)).run()
    })
    .catch(() => {
      document.execCommand('paste')
      editor.commands.focus()
    })
}

export function deleteSelection(editor: Editor): void {
  editor.chain().focus().deleteSelection().run()
}

/** 选区序列化为 markdown 源码 */
export function copyAsMarkdown(editor: Editor): Promise<void> {
  const { from, to } = editor.state.selection
  if (from === to) return Promise.resolve()
  const slice = editor.state.doc.slice(from, to)
  const json = slice.toJSON()
  const md = getMarkdownManager().serialize({ type: 'doc', content: json.content ?? [] })
  return navigator.clipboard.writeText(md).catch(() => toastCopyError())
}

/** 选区渲染为 HTML(复用预览管线) */
export function copyAsHtml(editor: Editor): Promise<void> {
  const html = renderMarkdown(selectedText(editor)).html
  if (!html) return Promise.resolve()
  return navigator.clipboard.writeText(html).catch(() => toastCopyError())
}

/** 选区去掉 markdown 标记后复制 */
export function copySimplified(editor: Editor): Promise<void> {
  const text = simplifyMarkdown(selectedText(editor))
  if (!text) return Promise.resolve()
  return navigator.clipboard.writeText(text).catch(() => toastCopyError())
}

function toastCopyError(): void {
  import('sonner').then(({ toast }) => toast.error('剪贴板操作失败'))
}
