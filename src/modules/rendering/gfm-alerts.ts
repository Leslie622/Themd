import type { MarkdownIt, StateCore } from 'markdown-it'

/**
 * GFM Alerts（`> [!NOTE]` 等提示块）的 markdown-it 规则。
 * 仿 antfu/markdown-it-github-alerts 的 core-rule 思路（不引依赖，类名归 themd 命名空间）：
 * blockquote 首段是 `[!TYPE]` 标记时，blockquote 变身为 <div class="themd-callout themd-callout-note">，
 * 标记段替换成图标+类型名的标题行；不识别的类型原样保留（降级为普通引用块）。
 *
 * 源码层面零改动——导出的 .md 与输入完全一致，Typora/Obsidian 按各自实现渲染同一源码。
 */

const ALERT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const
export type GfmAlertType = (typeof ALERT_TYPES)[number]

export const ALERT_LABELS: Record<GfmAlertType, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
}

/** Octicon 图标(GitHub 同款),16×16,currentColor 继承强调色 */
export const ALERT_ICONS: Record<GfmAlertType, string> = {
  note: 'M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
  tip: 'M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.75.75 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z',
  important: 'M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  warning: 'M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.083 15H1.917a1.75 1.75 0 0 1-1.542-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  caution: 'M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25a.749.749 0 0 1-.53.22H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z',
}

/** 提示块标题行 HTML(静态侧与 TipTap 静态序列化器共用,字节同源) */
export function titleHtml(type: GfmAlertType): string {
  const label = ALERT_LABELS[type]
  const icon = `<svg class="themd-callout-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="${ALERT_ICONS[type]}"></path></svg>`
  return `<p class="themd-callout-title">${icon}${label}</p>`
}

/** 匹配 blockquote 首段的 [!TYPE] 标记(大小写敏感,GitHub 同款只认大写) */
const ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:\n|$)/

/**
 * core 规则:块级解析完成后遍历 token 流找 alert 引用块。
 * 引用块的首个段落若为 [!TYPE] 标记段:
 *   blockquote_open/open → tag 改 div、加 themd-callout 类
 *   标记段(段落三件套) → 替换为 title html 块
 */
function gfmAlertsRule(state: StateCore): void {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i]
    if (open.type !== 'blockquote_open') continue

    // 引用块内首个内容段:paragraph_open → inline → paragraph_close
    const pOpen = tokens[i + 1]
    const inline = tokens[i + 2]
    const pClose = tokens[i + 3]
    if (
      pOpen?.type !== 'paragraph_open' ||
      inline?.type !== 'inline' ||
      pClose?.type !== 'paragraph_close'
    ) {
      continue
    }

    // inline 的 content 是原始文本(markdown 源),标记必须独占首行
    const m = ALERT_MARKER.exec(inline.content)
    if (!m) continue
    const type = m[1].toLowerCase() as GfmAlertType

    // 深度扫描找配对的 blockquote_close——callout 内容可以有多段/嵌套列表/嵌套引用
    let depth = 1
    let closeIdx = -1
    for (let j = i + 1; j < tokens.length; j++) {
      if (tokens[j].type === 'blockquote_open') depth++
      else if (tokens[j].type === 'blockquote_close' && --depth === 0) {
        closeIdx = j
        break
      }
    }
    if (closeIdx === -1) continue

    open.tag = 'div'
    open.attrs = [
      ['class', `themd-callout themd-callout-${type}`],
      ['data-alert', type],
    ]
    tokens[closeIdx].tag = 'div'

    // 标记段处理:标题行(内嵌图标)替换/前插
    const titleToken = new state.Token('html_block', '', 0)
    titleToken.content = titleHtml(type)
    // 有无正文看整段原始源码(inline.content);渲染依据是 children(inline 解析先于
    // core 规则),text 子 token 在软换行处截断,标记行必是独立的第一个 text child
    const hasRest = inline.content.replace(ALERT_MARKER, '').trim().length > 0
    const children = inline.children ?? []
    if (hasRest) {
      // 同段还有正文:剥掉首 text 里的标记行(空了就连同紧随的软换行一起删),标题前插
      const first = children[0]
      if (first?.type === 'text') {
        first.content = first.content.replace(ALERT_MARKER, '')
        if (!first.content) {
          children.shift()
          if (children[0]?.type === 'softbreak') children.shift()
        }
      }
      tokens.splice(i + 1, 0, titleToken)
    } else {
      // 标记独占一段:整个段落三件套换成标题
      tokens.splice(i + 1, 3, titleToken)
    }
  }
}

export function gfmAlerts(md: MarkdownIt): void {
  md.core.ruler.push('themd_gfm_alerts', gfmAlertsRule)
}
