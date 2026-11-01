/**
 * TipTap v3 Markdown 引擎封装(infrastructure 层,headless)。
 *
 * 官方 @tiptap/markdown 基于 marked,MarkdownManager.parse/serialize
 * 直接吃扩展数组、输出 JSONContent,不碰 DOM——守门测试可跑在 node 环境。
 *
 * 序列化保真定制:官方 Table 渲染器会做列宽对齐填充(`| a   |`)并在表格
 * 前后加换行,语义等价但不字节等价。这里用 Table.extend 覆盖
 * renderMarkdown,输出无填充的单行距表格——「每扩展可自定义序列化规则」
 * 正是双引擎方案字节保真协议的承重点。
 *
 * 验证过的保真现状(P0 PoC):
 * - 完美往返:ATX 标题/段落/粗斜(**与*风格都保留)/删除线/行内代码/
 *   有序无序列表/任务列表/引用/围栏代码(含 info 串)/链接/图片(含 title)
 * - 已知规范化(未编辑块由 sourceMap 原文兜底,编辑块由 P3 风格档案吸收):
 *   Setext 标题 → ATX;表格列宽经本文件定制后不再填充
 */
import { MarkdownManager } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Table, escapeTableCellPipes } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import type { JSONContent } from '@tiptap/core'

import type { BlockRecord } from '../domain/block-source-map'

/** MarkdownManager 渲染辅助器的最小面(官方 h 的子集,够表格用) */
interface RenderHelper {
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

/** 无填充表格渲染:与手写笔记的紧凑表格逐字节同型 */
function renderLeanTable(node: JSONContent, h: RenderHelper): string {
  const rows: { cells: string[]; delimiters: string[]; header: boolean }[] = []
  for (const row of node.content ?? []) {
    const cells: string[] = []
    const delimiters: string[] = []
    let header = false
    for (const cell of row.content ?? []) {
      if (cell.type === 'tableHeader') header = true
      delimiters.push(delimiterFor(cell.attrs?.align))
      // 单元格内换行 → <br>(多行单元格的 P4 细化前先保语义)
      const text = escapeTableCellPipes(h.renderChildren(cell.content ?? cell).replace(/\r?\n/g, '<br>'))
      cells.push(text.trim())
    }
    rows.push({ cells, delimiters, header })
  }
  if (rows.length === 0) return ''
  const width = rows.reduce((max, r) => Math.max(max, r.cells.length), 0)
  const pad = (cells: string[]) => {
    const out = [...cells]
    while (out.length < width) out.push('')
    return out
  }
  const lines = [`| ${pad(rows[0].cells).join(' | ')} |`, `| ${pad(rows[0].delimiters).join(' | ')} |`]
  // 首行非 header 的无头表:GFM 语法要求第二行是分隔行,首行按 header 输出
  // (与官方渲染器一致;无头表的语义保真在 P4 表格扩展时再收)
  for (const row of rows.slice(1)) lines.push(`| ${pad(row.cells).join(' | ')} |`)
  return lines.join('\n')
}

let manager: MarkdownManager | null = null

/** 引擎单例:扩展装配唯一入口(P1 接入编辑器时复用同一份) */
export function getMarkdownManager(): MarkdownManager {
  manager ??= new MarkdownManager({
    extensions: [
      StarterKit,
      Image,
      Table.extend({ renderMarkdown: renderLeanTable }),
      TaskList,
      TaskItem,
    ],
  })
  return manager
}

export function parseBlockMarkdown(text: string): JSONContent {
  return getMarkdownManager().parse(text)
}

export function serializeBlockMarkdown(doc: JSONContent): string {
  return getMarkdownManager().serialize(doc)
}

/** 单块往返:parse → serialize(编辑过块的序列化输出形态) */
export function roundTripBlockMarkdown(text: string): string {
  return serializeBlockMarkdown(parseBlockMarkdown(text))
}

/** 剥掉块尾的一个行终止符(\r\n 或 \n),保留给重组时回贴 */
function stripTerminator(text: string): { body: string; term: string } {
  if (text.endsWith('\r\n')) return { body: text.slice(0, -2), term: '\r\n' }
  if (text.endsWith('\n')) return { body: text.slice(0, -1), term: '\n' }
  return { body: text, term: '' }
}

/**
 * 协议序列化:未编辑块逐字节吐原文,dirty 块走 PM parse→serialize
 * (块尾终止符不属于 PM 输出,剥出后原样回贴,块与块不会粘连)。
 */
export function serializeLiveBlocks(blocks: BlockRecord[]): string {
  return blocks
    .map((b) => {
      if (!b.dirty) return b.text + b.separator
      const { body, term } = stripTerminator(b.text)
      return roundTripBlockMarkdown(body) + term + b.separator
    })
    .join('')
}
