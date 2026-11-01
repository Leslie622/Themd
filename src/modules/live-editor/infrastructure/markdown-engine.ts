/**
 * TipTap v3 Markdown 引擎封装(infrastructure 层,headless)。
 *
 * 官方 @tiptap/markdown 基于 marked,MarkdownManager.parse/serialize
 * 直接吃扩展数组、输出 JSONContent,不碰 DOM——守门测试可跑在 node 环境。
 * 扩展装配在 tiptap-setup.ts(与编辑器共用)。
 *
 * 验证过的保真现状(P0 PoC):
 * - 完美往返:ATX 标题/段落/粗斜(**与*风格都保留)/删除线/行内代码/
 *   有序无序列表/任务列表/引用/围栏代码(含 info 串)/链接/图片(含 title)/
 *   表格(无填充定制渲染,两种对齐形式)
 * - 已知规范化(未编辑块由 sourceMap 原文兜底,编辑块由 P3 风格档案吸收):
 *   Setext 标题 → ATX
 */
import { MarkdownManager } from '@tiptap/markdown'
import type { JSONContent } from '@tiptap/core'

import type { SerializableBlock } from '../domain/reconcile-blocks'
import { liveExtensions } from './tiptap-setup'

let manager: MarkdownManager | null = null

/** 引擎单例:扩展装配唯一入口(tiptap-setup,与编辑器同源) */
export function getMarkdownManager(): MarkdownManager {
  manager ??= new MarkdownManager({ extensions: [...liveExtensions()] })
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
export function stripTerminator(text: string): { body: string; term: string } {
  if (text.endsWith('\r\n')) return { body: text.slice(0, -2), term: '\r\n' }
  if (text.endsWith('\n')) return { body: text.slice(0, -1), term: '\n' }
  return { body: text, term: '' }
}

/**
 * 协议序列化(静态块表,守门测试用):未编辑块逐字节吐原文,dirty 块走
 * PM parse→serialize(块尾终止符不属于 PM 输出,剥出后原样回贴)。
 * 运行时(编辑事务增量维护)走 LiveEditorController,同一套语义。
 */
export function serializeLiveBlocks(blocks: readonly SerializableBlock[]): string {
  return blocks
    .map((b) => {
      if (!b.dirty) return b.text + b.separator
      // dirtyText 已含终止符(reconcile 产出);静态路径(守门测试)按原文剥算
      if (b.dirtyText !== undefined) return b.dirtyText + b.separator
      const { body, term } = stripTerminator(b.text)
      return roundTripBlockMarkdown(body) + term + b.separator
    })
    .join('')
}
