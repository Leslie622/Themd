import { StateField, type EditorState, type Range } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'

/**
 * 编辑器里的内嵌数据徽章(纯显示层装饰)。
 * 图片以内嵌 base64 进正文(见 lib/image.ts),一行 URL 可达二三十万字符,
 * 直接展示是一屏乱码。这里用 replace 装饰把 `![alt](data:…)` 里的 URL 段
 * 换成短徽章:
 * - 存储/预览/导出仍用完整 markdown,原文不动,随时可撤的纯视图改动
 * - 光标或选区压住区间时露出原文(可编辑);平时 atomicRanges 把方向键
 *   /点击落点整体挡在区间外
 * - 点击徽章选中整段标记,回车/删除即整段操作
 *
 * 必须用 StateField 挂进 EditorView.decorations(state 层),不能用
 * ViewPlugin 装饰:CodeMirror 的超长行压缩(自动换行下超过 ~2 万字符的行
 * 会插一块 LineGapWidget 占位)只统计 state 层装饰,看不见 ViewPlugin 的
 * 装饰就会按原始内容再插一块几万 px 的占位,与徽章叠加产生大段空白。
 */

/** data URL 超过此长度才隐藏,短的内联展示无碍阅读 */
const HIDE_THRESHOLD = 1024

/** 图片与链接两种形式都覆盖:`![alt](data:…)` / `[text](data:…)` */
const DATA_URL_RE = new RegExp(
  `!?\\[([^\\]]*)\\]\\((data:[^)]{${HIDE_THRESHOLD},})\\)`,
  'g',
)

const MIME_LABEL: Record<string, string> = {
  webp: 'WebP',
  png: 'PNG',
  jpeg: 'JPEG',
  jpg: 'JPEG',
  gif: 'GIF',
  'svg+xml': 'SVG',
  avif: 'AVIF',
  bmp: 'BMP',
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

/** 从 data URL 猜类型与体积(base64 长度 ×3/4 ≈ 原始字节数,展示个约数即可) */
function describeUrl(url: string): { label: string; title: string } {
  const mime = /^data:([^;,]*)/i.exec(url)?.[1]?.toLowerCase() ?? ''
  const sub = mime.startsWith('image/') ? mime.slice('image/'.length) : ''
  const kind = sub ? (MIME_LABEL[sub] ?? sub.toUpperCase()) : mime || 'data'
  const base64At = url.indexOf(';base64,')
  const bytes =
    base64At >= 0
      ? Math.floor(((url.length - base64At - ';base64,'.length) * 3) / 4)
      : url.length
  const size = formatBytes(Math.max(0, bytes))
  return {
    label: `${kind} · ${size}`,
    title: `内嵌数据(${kind},约 ${size})——点击选中整段标记`,
  }
}

class DataChipWidget extends WidgetType {
  readonly from: number
  readonly to: number
  readonly label: string
  readonly title: string

  constructor(from: number, to: number, label: string, title: string) {
    super()
    this.from = from
    this.to = to
    this.label = label
    this.title = title
  }

  eq(other: this) {
    return other.from === this.from && other.to === this.to && other.label === this.label
  }

  toDOM(view: EditorView) {
    const chip = document.createElement('span')
    chip.className = 'cm-img-chip'
    chip.title = this.title
    // lucide image 图标(与编辑器内联 SVG 同风格,stroke 走 currentColor)
    chip.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
    const text = document.createElement('span')
    text.textContent = this.label
    chip.appendChild(text)
    // 选中整段标记:选区压住区间后装饰自动撤掉,原文露出可直接删除/复制
    chip.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
        scrollIntoView: true,
      })
    })
    return chip
  }

  // 事件由上面的监听自己处理,不进 CM,避免 mousedown 被当作光标落点
  ignoreEvent() {
    return true
  }
}

function buildDecorations(state: EditorState): DecorationSet {
  const { doc, selection } = state
  const chips: Range<Decoration>[] = []
  // 全文档扫描,不是只扫可见区:图片行滚出视口后装饰也得常驻,高度图才稳定
  let pos = 0
  for (const text of doc.iterLines()) {
    const lineFrom = pos
    pos += text.length + 1
    // 廉价预筛:绝大多数行一次字符串查找就跳过
    if (!text.includes('](data:')) continue
    DATA_URL_RE.lastIndex = 0
    for (let m = DATA_URL_RE.exec(text); m; m = DATA_URL_RE.exec(text)) {
      // m[1] = alt 文本,m[2] = data URL(URL 紧跟 `(` 之后、末尾 `)` 之前)
      const url = m[2]
      const urlStart = lineFrom + m.index + m[0].length - url.length - 1
      const urlEnd = urlStart + url.length
      // 任一选区压住区间(空光标停在边界不算)就露出原文
      const covered = selection.ranges.some((r) => r.from < urlEnd && r.to > urlStart)
      if (covered) continue
      const info = describeUrl(url)
      chips.push(
        Decoration.replace({
          widget: new DataChipWidget(urlStart, urlEnd, info.label, info.title),
        }).range(urlStart, urlEnd),
      )
    }
  }
  return Decoration.set(chips, true)
}

const imageDecoField = StateField.define<DecorationSet>({
  create: (state) => buildDecorations(state),
  update(value, tr) {
    // 选区变化也要重算:选区压住区间时露出原文
    if (tr.docChanged || tr.selection) return buildDecorations(tr.state)
    return value
  },
  provide: (field) => EditorView.decorations.from(field),
})

// 徽章区间原子化:方向键/点击落点整体跳过隐藏的几十万字符
const imageAtomicRanges = EditorView.atomicRanges.of((view) =>
  view.state.field(imageDecoField, false) ?? Decoration.none,
)

const chipTheme = EditorView.theme({
  '.cm-img-chip': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    margin: '0 3px',
    padding: '1px 8px',
    borderRadius: '999px',
    backgroundColor: 'color-mix(in oklch, var(--muted-foreground) 14%, transparent)',
    color: 'var(--muted-foreground)',
    fontSize: '0.85em',
    verticalAlign: 'middle',
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  '.cm-img-chip:hover': {
    backgroundColor: 'color-mix(in oklch, var(--muted-foreground) 24%, transparent)',
    color: 'var(--foreground)',
  },
  '.cm-img-chip svg': {
    flex: 'none',
  },
})

export function imagePlaceholder() {
  return [chipTheme, imageDecoField, imageAtomicRanges]
}
