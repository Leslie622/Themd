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
import { NodeSelection, TextSelection } from '@tiptap/pm/state'

import { renderStaticHtml } from '@/modules/rendering/static-html'
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

/**
 * 选区序列化为 markdown 源码(剪贴板主通道,Typora 同款:text/plain 放的是
 * markdown 源码,粘到别处保持形状)。此前用 textBetween 取纯文本——图片等
 * 原子节点取出来是空串,复制/剪切直接静默失效。
 * 用 doc.cut 而非 doc.slice:部分块选区的 slice 是开放切片(块结构丢失,
 * 段落会拆成多块),cut 把边界闭合回所属块,序列化与原文块形一致。
 */
export function selectionToMarkdown(doc: Editor['state']['doc'], from: number, to: number): string {
  if (from === to) return ''
  return getMarkdownManager().serialize(doc.cut(from, to).toJSON() as never)
}

/** 选区 markdown;空序列化回落纯文本(保险,正常选区两者非空) */
function selectionPayload(editor: Editor): string {
  const { from, to } = editor.state.selection
  return selectionToMarkdown(editor.state.doc, from, to) || selectedText(editor)
}

export function copySelection(editor: Editor): Promise<void> {
  const text = selectionPayload(editor)
  if (!text) return Promise.resolve()
  return navigator.clipboard.writeText(text).catch(() => {
    toastCopyError()
  })
}

export function cutSelection(editor: Editor): Promise<void> {
  const text = selectionPayload(editor)
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
      // readText 失败如实提示(execCommand('paste') 在 Chromium 已被禁用,
      // 回落只会静默无效;系统 Ctrl+V 走编辑器原生粘贴管线不受影响)
      toastPasteError()
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
      toastPasteError()
      editor.commands.focus()
    })
}

export function deleteSelection(editor: Editor): void {
  editor.chain().focus().deleteSelection().run()
}

/** 节点选区(如右键选中的图片)序列化为 markdown;非节点选区返回 null */
export function nodeSelectionMarkdown(editor: Editor): string | null {
  const sel = editor.state.selection
  if (!(sel instanceof NodeSelection) || sel.from !== sel.to - (sel.node?.nodeSize ?? 1)) return null
  if (!sel.node) return null
  return getMarkdownManager().serialize({ type: 'doc', content: [sel.node.toJSON()] })
}

/** 复制右键选中的图片为 markdown(尺寸后缀一并保留) */
export function copyNodeAsMarkdown(editor: Editor): Promise<void> {
  const md = nodeSelectionMarkdown(editor)
  if (!md) return Promise.resolve()
  return navigator.clipboard.writeText(md).catch(() => toastCopyError())
}

/** 光标所在链接解除(右键链接菜单「移除链接」) */
export function removeLink(editor: Editor): void {
  editor.chain().focus().extendMarkRange('link').unsetLink().run()
}

/** 选区序列化为 markdown 源码 */
export function copyAsMarkdown(editor: Editor): Promise<void> {
  const { from, to } = editor.state.selection
  const md = selectionToMarkdown(editor.state.doc, from, to)
  if (!md) return Promise.resolve()
  return navigator.clipboard.writeText(md).catch(() => toastCopyError())
}

/** 选区渲染为 HTML(复用预览管线) */
export function copyAsHtml(editor: Editor): Promise<void> {
  const html = renderStaticHtml(selectedText(editor))
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

function toastPasteError(): void {
  import('sonner').then(({ toast }) => toast.error('读取剪贴板失败,可直接 Ctrl+V 粘贴'))
}
