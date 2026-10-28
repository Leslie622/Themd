import type { ElementDef } from './elements'

/**
 * inspect 模式（P5）：点击预览元素 → 定位到对应元素组。
 * 两轮匹配:先找容器类（引用/表格/代码块/列表…,点其内部任意位置都应命中容器）,
 * 再找行内与段落类（加粗/链接/标题/段落自身）。
 */
const CONTAINER_TARGETS: { id: ElementDef['id']; match: (el: Element) => boolean }[] = [
  { id: 'task', match: (el) => el.classList.contains('task-list-item') },
  { id: 'codeBlock', match: (el) => el.tagName === 'PRE' || (el.tagName === 'CODE' && el.closest('pre') !== null) },
  { id: 'quote', match: (el) => el.tagName === 'BLOCKQUOTE' },
  { id: 'table', match: (el) => ['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'].includes(el.tagName) },
  { id: 'ul', match: (el) => el.tagName === 'UL' || (el.tagName === 'LI' && el.closest('ul') !== null) },
  { id: 'ol', match: (el) => el.tagName === 'OL' || (el.tagName === 'LI' && el.closest('ol') !== null) },
  { id: 'hr', match: (el) => el.tagName === 'HR' },
  { id: 'img', match: (el) => el.tagName === 'IMG' },
]

const INLINE_TARGETS: { id: ElementDef['id']; match: (el: Element) => boolean }[] = [
  { id: 'strong', match: (el) => el.tagName === 'STRONG' },
  { id: 'em', match: (el) => el.tagName === 'EM' },
  { id: 'del', match: (el) => el.tagName === 'DEL' },
  { id: 'a', match: (el) => el.tagName === 'A' },
  { id: 'inlineCode', match: (el) => el.tagName === 'CODE' },
  { id: 'h1', match: (el) => el.tagName === 'H1' },
  { id: 'h2', match: (el) => el.tagName === 'H2' },
  { id: 'h3', match: (el) => el.tagName === 'H3' },
  { id: 'h4', match: (el) => el.tagName === 'H4' },
  { id: 'h5', match: (el) => el.tagName === 'H5' },
  { id: 'h6', match: (el) => el.tagName === 'H6' },
  { id: 'p', match: (el) => el.tagName === 'P' },
]

function walkUp(target: Element, targets: { id: ElementDef['id']; match: (el: Element) => boolean }[]): string | null {
  let el: Element | null = target
  while (el) {
    const current: Element = el
    const hit = targets.find((t) => t.match(current))
    if (hit) return hit.id
    el = el.parentElement
  }
  return null
}

/** 从点中的元素定位元素组 id;找不到回落 'root'（正文） */
export function inspectElementId(target: Element): string {
  return walkUp(target, CONTAINER_TARGETS) ?? walkUp(target, INLINE_TARGETS) ?? 'root'
}
