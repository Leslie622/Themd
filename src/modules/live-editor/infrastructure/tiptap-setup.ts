/**
 * 实时编辑引擎装配(infrastructure 层):MarkdownManager 与 TipTap 编辑器
 * 共用同一份扩展——解析/序列化规则与编辑器 schema 严格同源,禁止两处各配。
 */
import { Extension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Bold from '@tiptap/extension-bold'
import Italic from '@tiptap/extension-italic'
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
  escapeTableCellPipes,
} from '@tiptap/extension-table'
import { BulletList, OrderedList } from '@tiptap/extension-list'
import HardBreak from '@tiptap/extension-hard-break'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import type { JSONContent, MarkdownParseHelpers, MarkdownToken } from '@tiptap/core'

import { currentProfile } from './serialize-profile-state'
import { MathBlock, MathInline } from './math-node'
import { FrontMatter } from './frontmatter-node'
import { CodeBlockCm } from './codeblock-cm'
import { LiveImage } from './live-image'
import { CalloutBlockquote } from './callout-blockquote'
import { RawHtmlBlock, RawHtmlInline } from './raw-html'
import { LiveTableMenu } from './live-table-menu'

/** MarkdownManager 渲染辅助器的最小面(官方 h 的子集,够表格用) */
export interface RenderHelper {
  renderChildren: (nodeOrContent: JSONContent | JSONContent[]) => string
}

/** 单元格对齐标记:attr → GFM 分隔串 */
function delimiterFor(align: unknown): string {
  switch (align) {
    case 'left':
      return ':---'
    case 'right':
      return '---:'
    case 'center':
      return ':---:'
    default:
      return '---'
  }
}

/**
 * 无填充表格渲染:与手写笔记的紧凑表格逐字节同型。
 * 官方渲染器做列宽对齐填充(`| a   |`)并在表格前后加换行,语义等价但
 * 不字节等价——这里经 Table.extend 覆盖 renderMarkdown 收紧。
 */
function renderLeanTable(node: JSONContent, h: RenderHelper): string {
  const rows: { cells: string[]; delimiters: string[] }[] = []
  for (const row of node.content ?? []) {
    const cells: string[] = []
    const delimiters: string[] = []
    for (const cell of row.content ?? []) {
      delimiters.push(delimiterFor(cell.attrs?.align))
      // 单元格内换行 → <br>(多行单元格的 P4 细化前先保语义)
      const text = escapeTableCellPipes(h.renderChildren(cell.content ?? cell).replace(/\r?\n/g, '<br>'))
      cells.push(text.trim())
    }
    rows.push({ cells, delimiters })
  }
  if (rows.length === 0) return ''
  const width = rows.reduce((max, r) => Math.max(max, r.cells.length), 0)
  const pad = (cells: string[]) => {
    const out = [...cells]
    while (out.length < width) out.push('')
    return out
  }
  // 首行按 header 输出(无头表语义在 P4 表格扩展时再收,与官方渲染器一致)
  const lines = [
    `| ${pad(rows[0].cells).join(' | ')} |`,
    `| ${pad(rows[0].delimiters).join(' | ')} |`,
  ]
  for (const row of rows.slice(1)) lines.push(`| ${pad(row.cells).join(' | ')} |`)
  return lines.join('\n')
}

/**
 * 图片节点:见 live-image.ts——attrs 原始 src + 尺寸(WxH),渲染期解析地址,
 * 拖拽调宽写回尺寸后缀。
 */

/** 基础快捷键(纯 TipTap 命令,与 CM keymap 对齐;插入类在 live-shortcuts) */
const BaseShortcuts = Extension.create({
  name: 'liveBaseShortcuts',
  addKeyboardShortcuts() {
    const editor = this.editor
    return {
      'Mod-1': () => (editor.chain().focus().toggleHeading({ level: 1 }).run(), true),
      'Mod-2': () => (editor.chain().focus().toggleHeading({ level: 2 }).run(), true),
      'Mod-3': () => (editor.chain().focus().toggleHeading({ level: 3 }).run(), true),
      'Mod-4': () => (editor.chain().focus().toggleHeading({ level: 4 }).run(), true),
      'Mod-5': () => (editor.chain().focus().toggleHeading({ level: 5 }).run(), true),
      'Mod-6': () => (editor.chain().focus().toggleHeading({ level: 6 }).run(), true),
      'Mod-0': () => (editor.chain().focus().setParagraph().run(), true),
      'Mod-t': () => (
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), true
      ),
      'Mod-Shift-k': () => (editor.chain().focus().setCodeBlock().run(), true),
    }
  },
})

/**
 * 风格档案感知的强调序列化:输出标记跟随当前文档(全文 `__x__` 则编辑过
 * 的块也写 `__x__`,P3 方案 §4.4)。schema 与官方 Bold/Italic 完全一致,
 * 仅覆盖 renderMarkdown。
 */
const ProfileBold = Bold.extend({
  renderMarkdown(node, h) {
    return `${currentProfile().strong}${h.renderChildren(node)}${currentProfile().strong}`
  },
})

const ProfileItalic = Italic.extend({
  renderMarkdown(node, h) {
    return `${currentProfile().em}${h.renderChildren(node)}${currentProfile().em}`
  },
})

/**
 * breaks:true 政策(契约 §2)下软换行解析为 br,序列化须还原单 \n
 * (Typora/Obsidian 同款语义,单 \n 往返即 br)。官方默认吐两空格硬断行
 * `␣␣\n`,会把编辑过块里的软换行改写出字节漂移。
 */
const CanonicalHardBreak = HardBreak.extend({
  renderMarkdown: () => '\n',
})

/**
 * 契约 §3「紧凑/宽松两形态」:捕获 marked 列表 token 的 loose 进 tight 属性。
 * 仅静态序列化器(rendering/golden/static-html)消费;renderHTML 置空、
 * renderMarkdown 不读 = 编辑器 DOM 与字节保真协议零影响。
 * bulletList 侧与官方逐字同构仅加 attrs;orderedList 侧以 helpers.parseChildren
 * 平替官方内部 parseListItems(差异由金样对答案测试暴露)。
 */
function listTightAttrs(token: MarkdownToken): Record<string, unknown> {
  return { tight: !(token as { loose?: boolean }).loose }
}

const CanonicalBulletList = BulletList.extend({
  addAttributes() {
    return { ...this.parent?.(), tight: { default: true, renderHTML: () => ({}) } }
  },
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    if (token.type !== 'list' || (token as { ordered?: boolean }).ordered) return []
    return {
      type: 'bulletList',
      attrs: listTightAttrs(token),
      content: token.items ? helpers.parseChildren(token.items) : [],
    }
  },
})

const CanonicalOrderedList = OrderedList.extend({
  addAttributes() {
    return { ...this.parent?.(), tight: { default: true, renderHTML: () => ({}) } }
  },
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    if (token.type !== 'list' || !(token as { ordered?: boolean }).ordered) return []
    const attrs: Record<string, unknown> = listTightAttrs(token)
    const start = (token as { start?: number }).start || 1
    if (start !== 1) attrs.start = start
    const typeMarker = (token as { typeMarker?: string }).typeMarker
    if (typeMarker) attrs.type = typeMarker
    return {
      type: 'orderedList',
      attrs,
      content: token.items ? helpers.parseChildren(token.items) : [],
    }
  },
})

/** 实时编辑扩展集:编辑器 schema 与 markdown 解析/序列化的唯一装配点 */
export function liveExtensions() {
  return [
    // bold/italic 换档案感知版、codeBlock 换 CM 内嵌版、blockquote 换 GFM Alerts
    // 感知版、bulletList/orderedList 换契约 tight 捕获版、hardBreak 换单 \n
    // 序列化版(schema 均同型)
    StarterKit.configure({
      bold: false,
      italic: false,
      codeBlock: false,
      link: false,
      blockquote: false,
      bulletList: false,
      orderedList: false,
      hardBreak: false,
    }),
    // 链接点击禁止扩展自带的 window.open(Tauri WebView 无弹窗拦截,会把
    // 整个应用页面导航走);交互与 CM 版对齐:普通点击=定位光标,右键菜单打开
    Link.configure({ openOnClick: false }),
    ProfileBold,
    ProfileItalic,
    CanonicalBulletList,
    CanonicalOrderedList,
    CanonicalHardBreak,
    LiveImage,
    CalloutBlockquote,
    RawHtmlBlock,
    RawHtmlInline,
    MathBlock,
    MathInline,
    FrontMatter,
    CodeBlockCm,
    Table.extend({ renderMarkdown: renderLeanTable }),
    TableRow,
    TableCell,
    TableHeader,
    TaskList,
    TaskItem,
    LiveTableMenu,
    BaseShortcuts,
  ] as const
}
