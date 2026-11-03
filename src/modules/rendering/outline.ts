import type { Node as PMNode } from '@tiptap/pm/model'

import { parseStaticDoc } from './static-html'
import { slug } from './slug'

export interface OutlineItem {
  /** 标题级别 1-6(h1-h6) */
  level: number
  /** 标题文本(去内联标记后的纯文本,仅展示用) */
  text: string
  /** 锚点 id,与渲染 HTML 的 heading id 同源(slug) */
  id: string
}

/**
 * 从 markdown 源码提取大纲(预览区 TOC)。与静态渲染同一解析管线
 * (parseStaticDoc):id = slug(node.textContent),与 renderStaticHtml 的
 * heading id 完全同源——跳转直接 querySelector 命中。
 * 渲染统一第 5 步:原实现走 markdown-it md.parse(oracle 侧),已切 TipTap
 * 管线;顺带修掉隐性错位——旧 id 取 md-it 原始 token 文本(含行内标记
 * 字符),与渲染侧 PM textContent 的 id 在 `## **粗** 标题` 类标题上不一致。
 * 与渲染器同样不去重:重复标题的跳转取文档首个(与现状一致)。
 */
export function buildOutline(content: string): OutlineItem[] {
  const items: OutlineItem[] = []
  collectHeadings(parseStaticDoc(content), items)
  return items
}

function collectHeadings(node: PMNode, items: OutlineItem[]): void {
  node.forEach((child) => {
    if (child.type.name === 'heading') {
      const text = child.textContent
      if (text.trim()) {
        items.push({ level: child.attrs.level as number, text, id: slug(text) })
      }
    } else {
      collectHeadings(child, items)
    }
  })
}
