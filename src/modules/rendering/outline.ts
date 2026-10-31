import { md, slug } from './markdown-renderer'

export interface OutlineItem {
  /** 标题级别 1-6(h1-h6) */
  level: number
  /** 标题文本(去内联标记后的纯文本,仅展示用) */
  text: string
  /** 锚点 id,与渲染 HTML 的 heading id 同源(slug) */
  id: string
}

/**
 * 从 markdown 源码提取大纲(预览区 TOC)。复用 md.parse 与渲染期的 slug,
 * 保证大纲 id 与渲染 HTML 的 id 完全一致——跳转直接 querySelector 命中。
 * 与渲染器同样不去重:重复标题的跳转取文档首个(与现状一致)。
 */
export function buildOutline(content: string): OutlineItem[] {
  const items: OutlineItem[] = []
  const tokens = md.parse(content, {})
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type !== 'heading_open') continue
    const textToken = tokens[i + 1]
    if (!textToken?.content?.trim()) continue
    // 展示文本走 renderInlineAsText 去内联标记(如 **加粗**);id 与渲染规则
    // 一样取原始 content 计算,两边必然一致
    const text = md.renderer.renderInlineAsText(textToken.children ?? [], md.options, {})
    items.push({ level: Number(token.tag.slice(1)), text, id: slug(textToken.content) })
  }
  return items
}
