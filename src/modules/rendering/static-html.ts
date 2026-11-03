/**
 * TipTap 静态序列化器(渲染统一第 2 步核心件,docs/渲染统一方案.md §8-2)。
 *
 * 职责:markdown →(MarkdownManager.parse,schema 与编辑器同源)→ PM doc
 * → 规范 HTML 字符串。无 DOM、可在 node 环境跑,输出与 docs/渲染结构契约.md
 * 逐字节对齐——静态消费方(预览/工厂/导出/复制)的统一渲染函数。
 *
 * 与 @tiptap/html 的 generateHTML 语义等价(走 schema toDOM),但自持
 * DOMOutputSpec 解释器:属性顺序/空白/转义完全受控,才可能字节级复现金样
 * (守门见 golden/golden-parity.test.ts)。
 * 契约特例(heading id/taskItem/mermaid/math/callout/表格对齐等)在此分派;
 * 未覆盖节点走 schema toDOM 兜底。
 *
 * 环境相关行为:图片 src 经 resolveImageSrcSync 渲染期解析(与 md-it 旧管线
 * 同一函数);测试环境未注入时为恒等,故金样语料(远程/data URI)不受影响
 * (契约 §5:环境相关的 src 改写不冻结在语料里)。
 */
import { getSchema } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { Node as PMNode, Mark as PMMark, NodeSpec } from '@tiptap/pm/model'
import katex from 'katex'

import { getMarkdownManager } from '@/modules/live-editor/infrastructure/markdown-engine'
import { liveExtensions } from '@/modules/live-editor/infrastructure/tiptap-setup'
import { resolveImageSrcSync, imageContextSignature } from '@/lib/image-src'
import { slug, highlightCode } from './markdown-renderer'
import { titleHtml } from './gfm-alerts'

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input'])

/** 与 markdown-it 转义集一致(& < > ",单引号不转义) */
const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** 有序属性表:契约对属性顺序有字节级要求 */
type Attrs = Array<[string, string]>

function openTag(tag: string, attrs: Attrs): string {
  if (attrs.length === 0) return `<${tag}`
  const body = attrs.map(([k, v]) => `${k}="${escapeHtml(v)}"`).join(' ')
  return `<${tag} ${body}`
}

function element(tag: string, attrs: Attrs, inner = ''): string {
  if (VOID_TAGS.has(tag)) return `${openTag(tag, attrs)}>`
  return `${openTag(tag, attrs)}>${inner}</${tag}>`
}

let schemaCache: ReturnType<typeof getSchema> | null = null
function staticSchema() {
  schemaCache ??= getSchema([...liveExtensions()])
  return schemaCache
}

/**
 * markdown → 规范 HTML(顶层块以 \n 连接,与 markdown-it 输出一致)。
 * LRU 缓存(容量 32):静态管线实测比 md.render 慢约 3.4×(36KB 文档
 * 166ms vs 50ms),切回已看过的笔记/工厂样例重挂载走缓存零成本;
 * 键 = 图片解析上下文签名 + 源文(src 解析是渲染期环境行为,上下文
 * 变化即失效,见 lib/image-src 的 imageContextSignature)。
 */
const HTML_CACHE_CAP = 32
const htmlCache = new Map<string, string>()

export function renderStaticHtml(markdown: string): string {
  const key = `${imageContextSignature()}\u0000${markdown}`
  const hit = htmlCache.get(key)
  if (hit !== undefined) {
    // Map 迭代序=插入序,命中后移到末尾保持 LRU 语义
    htmlCache.delete(key)
    htmlCache.set(key, hit)
    return hit
  }
  const json = sanitizeJson(getMarkdownManager().parse(markdown))
  const doc = staticSchema().nodeFromJSON(json)
  const html = renderBlockChildren(doc)
  if (htmlCache.size >= HTML_CACHE_CAP) {
    const oldest = htmlCache.keys().next().value
    if (oldest !== undefined) htmlCache.delete(oldest)
  }
  htmlCache.set(key, html)
  return html
}

/** MarkdownManager.parse 产出的 JSON 可能含空文本节点(prosemirror 拒收),递归剔除 */
function sanitizeJson(node: JSONContent): JSONContent {
  if (!Array.isArray(node.content)) return node
  return {
    ...node,
    content: node.content
      .filter((child) => !(child.type === 'text' && !child.text))
      .map(sanitizeJson),
  }
}

function renderBlockChildren(parent: PMNode): string {
  const parts: string[] = []
  let prevNoSeparator = false
  parent.forEach((child) => {
    const html = renderBlock(child)
    // md-it 语义:各块渲染规则自带尾换行责任,纯拼接。raw HTML 原文含 \n、
    // mermaid fence 规则不带尾换行(下一块紧贴同行)→ 前块命中其一即不补分隔
    if (parts.length && !prevNoSeparator) parts.push('\n')
    parts.push(html)
    const isMermaid =
      child.type.name === 'codeBlock' && String(child.attrs.language ?? '').toLowerCase() === 'mermaid'
    prevNoSeparator = isMermaid || html.endsWith('\n')
  })
  return parts.join('')
}

function renderBlock(node: PMNode): string {
  switch (node.type.name) {
    case 'heading':
      return element(`h${node.attrs.level as number}`, [['id', slug(node.textContent)]], renderInlines(node))
    case 'paragraph':
      return element('p', [], renderInlines(node))
    case 'bulletList':
      return element('ul', [], renderListItems(node))
    case 'orderedList': {
      const start = node.attrs.start as number | undefined
      const attrs: Attrs = start && start !== 1 ? [['start', String(start)]] : []
      return element('ol', attrs, renderListItems(node))
    }
    case 'taskList':
      return element('ul', [['class', 'contains-task-list']], renderListItems(node))
    case 'listItem':
      return renderListItem(node)
    case 'taskItem':
      return renderTaskItem(node)
    case 'blockquote':
      return renderBlockquote(node)
    case 'codeBlock':
      return renderCodeBlock(node)
    case 'mathBlock':
      return renderKatex(node.textContent, true)
    case 'table':
      return renderTable(node)
    case 'horizontalRule':
      return '<hr>'
    case 'image':
      return renderImg(node)
    case 'rawHtmlBlock':
      // 解析保真政策①:schema 不认识的块级 HTML 原样透传
      return String(node.attrs.html ?? '')
    default: {
      const spec = (node.type.spec as NodeSpec).toDOM?.(node)
      if (!spec || typeof spec !== 'object' || !Array.isArray(spec)) {
        throw new Error(`static-html: 节点 ${node.type.name} 无可解释的 toDOM spec(需补契约特例)`)
      }
      const attrs: Attrs = []
      const raw = spec[1]
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [k, v] of Object.entries(raw)) {
          if (v === null || v === undefined || v === false) continue
          attrs.push([k, v === true ? '' : String(v)])
        }
      }
      return element(spec[0] as string, attrs, node.isLeaf ? '' : renderBlockChildren(node))
    }
  }
}

/**
 * 列表项:契约 §3「紧凑/宽松两形态」——tight 属性在列表节点上
 * (tiptap-setup 的 Canonical*List 捕获 token.loose)。
 * 紧凑:首段 inline 直出、嵌套块后置换行、尾 </li> 前补换行(md-it 同型);
 * 宽松:子块逐个 <p> 包裹、整体换行缩进一级。
 */
function childrenOf(node: PMNode): PMNode[] {
  const blocks: PMNode[] = []
  node.forEach((child) => blocks.push(child))
  return blocks
}

function renderListItem(node: PMNode, loose = false): string {
  const blocks = childrenOf(node)
  if (loose) {
    const inner = blocks.length ? `\n${blocks.map(renderBlock).join('\n')}\n` : ''
    return element('li', [], inner)
  }
  const [first, ...rest] = blocks
  const head = first
    ? first.type.name === 'paragraph'
      ? renderInlines(first)
      : renderBlock(first)
    : ''
  const inner = head + rest.map((b) => `\n${renderBlock(b)}`).join('') + (rest.length ? '\n' : '')
  return element('li', [], inner)
}

function renderTaskItem(node: PMNode): string {
  const checked = node.attrs.checked ? ' checked=""' : ''
  // 契约 §3:input 紧贴文本(无空格字符,间距由 input margin-right 承担)
  const input = `<input class="task-list-item-checkbox"${checked} disabled="" type="checkbox">`
  const blocks: PMNode[] = []
  node.forEach((child) => blocks.push(child))
  const head = blocks[0]?.type.name === 'paragraph' ? renderInlines(blocks[0]) : ''
  const tail = blocks.slice(1).map((b) => `\n${renderBlock(b)}`)
  return element('li', [['class', 'task-list-item']], head ? input + head + tail.join('') : input)
}

function renderListItems(list: PMNode): string {
  const loose = list.attrs.tight === false
  const parts: string[] = []
  list.forEach((child) =>
    parts.push(child.type.name === 'taskItem' ? renderTaskItem(child) : renderListItem(child, loose)),
  )
  return '\n' + parts.join('\n') + '\n'
}

function renderBlockquote(node: PMNode): string {
  const alertType = node.attrs.alertType as string | null | undefined
  if (!alertType) {
    return element('blockquote', [], `\n${renderBlockChildren(node)}\n`)
  }
  // md-it 的提示块标题走 html_block(无尾换行)→ 标题与首个正文段同行
  const body = childrenOf(node)
    .map(renderBlock)
    .join('\n')
  return element(
    'div',
    [
      ['class', `themd-callout themd-callout-${alertType}`],
      ['data-alert', alertType],
    ],
    `\n${titleHtml(alertType as 'note')}${body}\n`,
  )
}

function renderCodeBlock(node: PMNode): string {
  // marked→codeBlock 解析会剥掉 fence 内容的尾换行,md-it 的 token.content 恒带尾 \n
  const raw = node.textContent
  const code = raw && !raw.endsWith('\n') ? `${raw}\n` : raw
  const lang = String(node.attrs.language ?? '').trim()
  if (lang.toLowerCase() === 'mermaid') {
    return element(
      'div',
      [
        ['class', 'themd-mermaid'],
        ['data-src', encodeURIComponent(code)],
      ],
      escapeHtml(code),
    )
  }
  const highlighted = highlightCode(code, lang)
  const inner = highlighted || escapeHtml(code)
  return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${inner}</code></pre>`
}

function renderKatex(tex: string, displayMode: boolean): string {
  // @mdit/plugin-katex 块级公式:annotation 保留 tex 尾换行(冻结即规范),
  // 而本地 mathBlock 解析两侧都 trim 了——静态侧补回,数学渲染本身不变
  const html = katex.renderToString(displayMode ? `${tex}\n` : tex, {
    throwOnError: false,
    displayMode,
  })
  // 块级外层形态:p.katex-block(单引号,与插件一致)
  return displayMode ? `<p class='katex-block'>${html}</p>` : html
}

function renderImg(node: PMNode): string {
  const { src, alt, title } = node.attrs as Record<string, string | null>
  const attrs: Attrs = [
    // 渲染期地址解析(桌面端 asset:// 协议),与 md-it 旧管线同一函数
    ['src', resolveImageSrcSync(src ?? '')],
    ['alt', alt ?? ''],
  ]
  if (title) attrs.push(['title', title])
  attrs.push(['loading', 'lazy'], ['decoding', 'async'])
  return element('img', attrs)
}

function renderTable(node: PMNode): string {
  const rows: PMNode[] = []
  node.forEach((child) => rows.push(child))
  const renderRow = (row: PMNode): string => {
    const cells: string[] = []
    row.forEach((cell) => {
      const tag = cell.type.name === 'tableHeader' ? 'th' : 'td'
      const align = cell.attrs.align as string | null | undefined
      const attrs: Attrs = align ? [['style', `text-align:${align}`]] : []
      cells.push(element(tag, attrs, renderInlines(cell)))
    })
    return element('tr', [], `\n${cells.join('\n')}\n`)
  }
  if (rows.length === 0) return element('table', [])
  const [header, ...bodyRows] = rows
  const thead = element('thead', [], `\n${renderRow(header)}\n`)
  const tbody =
    bodyRows.length > 0
      ? element('tbody', [], '\n' + bodyRows.map(renderRow).join('\n') + '\n')
      : ''
  return element('table', [], tbody ? `\n${thead}\n${tbody}\n` : `\n${thead}\n`)
}

function renderInlines(parent: PMNode): string {
  const parts: string[] = []
  parent.forEach((child) => {
    switch (child.type.name) {
      case 'text':
        parts.push(renderText(child))
        break
      case 'hardBreak':
        // markdown-it 的 softbreak/hardbreak 都渲染 <br>\n
        parts.push('<br>\n')
        break
      case 'mathInline':
        parts.push(renderKatex(child.textContent, false))
        break
      case 'image':
        parts.push(renderImg(child))
        break
      case 'rawHtmlInline':
        parts.push(String(child.attrs.html ?? ''))
        break
      default:
        if (child.isLeaf) {
          const spec = (child.type.spec as NodeSpec).toDOM?.(child)
          if (Array.isArray(spec)) {
            const tag = spec[0] as string
            parts.push(element(tag, [], typeof spec[1] === 'object' ? '' : ''))
          }
        } else {
          parts.push(renderInlines(child))
        }
    }
  })
  return parts.join('')
}

/**
 * 文本节点渲染:实体解码 + typographer 替换 + 转义。
 * md-it(html:true)在解析期解码实体、typographer 改写标点;marked 两者都不做,
 * PM 文本保留字面——静态侧在此补齐(输入线下沉 parse 是后续任务,见契约 §5)。
 * code 标记内不做任何替换(代码字面)。
 */
const ENTITY_MAP: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', nbsp: '\u00a0',
}

function decodeEntities(s: string): string {
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (raw, body: string) => {
    if (body.startsWith('#')) {
      const hex = body.startsWith('#x') || body.startsWith('#X')
      const num = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(num) && num > 0 && num <= 0x10ffff ? String.fromCodePoint(num) : raw
    }
    return ENTITY_MAP[body] ?? raw
  })
}

/** typographer 子集(对齐语料覆盖:省略号/三连与两连破折/版权/成对引号) */
function typographer(s: string): string {
  return s
    .replace(/\.\.\./g, '…')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/\(c\)/g, '©')
    .replace(/"([^"]*)"/g, '“$1”')
    .replace(/'([^']*)'/g, '‘$1’')
}

function renderText(node: PMNode): string {
  const raw = node.text ?? ''
  if ((node.marks as readonly PMMark[]).some((m) => m.type.name === 'code')) {
    return renderMarks(escapeHtml(raw), node.marks)
  }
  return renderMarks(escapeHtml(typographer(decodeEntities(raw))), node.marks)
}

/** 嵌套序对齐 md-it:em 在 strong 外、code 恒最内(其余 mark 保稳定相对序) */
const MARK_ORDER: Record<string, number> = { italic: 0, bold: 1, code: 3 }
const markPriority = (m: PMMark): number => MARK_ORDER[m.type.name] ?? 2

function renderMarks(text: string, rawMarks: readonly PMMark[]): string {
  let html = text
  const marks = [...rawMarks].sort((a, b) => markPriority(a) - markPriority(b))
  for (let i = marks.length - 1; i >= 0; i--) {
    const mark = marks[i] as PMMark
    switch (mark.type.name) {
      case 'link': {
        const { href, title } = mark.attrs as Record<string, string | null>
        // md-it 的 normalizeLink 对非 ASCII 做百分号编码(链接引用定义吃中文目标即此形态)
        const attrs: Attrs = [['href', encodeURI(href ?? '')]]
        if (title) attrs.push(['title', title])
        html = element('a', attrs, html)
        break
      }
      case 'bold':
        html = element('strong', [], html)
        break
      case 'italic':
        html = element('em', [], html)
        break
      case 'code':
        html = element('code', [], html)
        break
      case 'strike':
        html = element('s', [], html)
        break
      default: {
        const spec = mark.type.spec.toDOM?.(mark, false)
        if (!Array.isArray(spec)) throw new Error(`static-html: mark ${mark.type.name} 无可解释的 toDOM spec`)
        const attrs: Attrs = []
        const raw = spec[1]
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          for (const [k, v] of Object.entries(raw)) {
            if (v === null || v === undefined || v === false) continue
            attrs.push([k, v === true ? '' : String(v)])
          }
        }
        html = element(spec[0] as string, attrs, html)
      }
    }
  }
  return html
}
