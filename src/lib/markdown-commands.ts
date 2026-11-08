import type { EditorView } from '@codemirror/view'

/**
 * 编辑器右键菜单用的 Markdown 编辑命令(纯 CodeMirror dispatch,不碰 React 状态)。
 * 全部命令执行后归还焦点给编辑器;选择区为空时行内命令退化为光标处插入模板。
 */

type Change = { from: number; to: number; insert: string }

/** 行前缀的识别(含引用/任务与普通列表的互相覆盖,剥离时循环至多两轮) */
const LINE_MARKER = /(?:^\s*>[ ]|^\s*[-*+][ ](?:\[[ xX]][ ])?|^\s*\d+[.)][ ])/

/** 行内标记切换:选中已带包裹则剥掉,否则包上(空选区 = 光标处插入一对标记) */
export function toggleInline(view: EditorView, before: string, after = before): void {
  const { state } = view
  const changes: Change[] = []
  for (const range of state.selection.ranges) {
    const text = state.sliceDoc(range.from, range.to)
    if (
      text.length >= before.length + after.length &&
      text.startsWith(before) &&
      text.endsWith(after)
    ) {
      changes.push({ from: range.from, to: range.from + before.length, insert: '' })
      changes.push({ from: range.to - after.length, to: range.to, insert: '' })
    } else {
      changes.push({ from: range.from, to: range.from, insert: before })
      changes.push({ from: range.to, to: range.to, insert: after })
    }
  }
  view.dispatch({ changes, scrollIntoView: true })
  view.focus()
}

/** 选中文字变为链接文本,并选中 url 占位符待替换 */
export function insertLink(view: EditorView): void {
  const { state } = view
  const range = state.selection.main
  const text = state.sliceDoc(range.from, range.to) || '链接文本'
  const insert = `[${text}](url)`
  const urlFrom = range.from + text.length + 3
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: urlFrom, head: urlFrom + 3 },
    scrollIntoView: true,
  })
  view.focus()
}

/** 块级行前缀切换:引用 / 无序 / 有序 / 任务;已带目标前缀的行剥掉,其余行替换成目标前缀 */
export function toggleLinePrefix(
  view: EditorView,
  kind: 'quote' | 'ulist' | 'olist' | 'task',
): void {
  const { state } = view
  const changes: Change[] = []
  let orderedIndex = 0
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let no = first; no <= last; no++) {
      const line = state.doc.line(no)
      // 剥掉现有前缀(至多两层,如任务列表里的 "- " 连同 "[ ] " 一起算一层)
      let consumed = 0
      for (let round = 0; round < 2; round++) {
        const m = line.text.slice(consumed).match(LINE_MARKER)
        if (!m) break
        consumed += m[0].length
      }
      const had = isKind(line.text.slice(0, consumed), kind)
      orderedIndex++
      const prefix = had
        ? ''
        : kind === 'quote'
          ? '> '
          : kind === 'ulist'
            ? '- '
            : kind === 'task'
              ? '- [ ] '
              : `${orderedIndex}. `
      changes.push({ from: line.from, to: line.from + consumed, insert: prefix })
    }
  }
  view.dispatch({ changes, scrollIntoView: true })
  view.focus()
}

/** 判断剥出来的前缀是否属于目标类型 */
function isKind(prefix: string, kind: 'quote' | 'ulist' | 'olist' | 'task'): boolean {
  const s = prefix.trim()
  if (kind === 'quote') return /^>(\s|$)/.test(s)
  if (kind === 'olist') return /^\d+[.)]$/.test(s)
  if (kind === 'task') return /^[-*+]\s\[[ xX]]$/.test(s)
  return /^[-*+]$/.test(s)
}

/** 设置标题层级:0 = 正文(去掉标题标记);其余在剥掉旧标记后加上对应层级的 # */
export function setHeading(view: EditorView, level: 0 | 1 | 2 | 3 | 4 | 5 | 6): void {
  const { state } = view
  const changes: Change[] = []
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let no = first; no <= last; no++) {
      const line = state.doc.line(no)
      const m = line.text.match(/^#{1,6}\s+/)
      const had = m ? m[0].length : 0
      const prefix = level > 0 ? `${'#'.repeat(level)} ` : ''
      if ((had ? m![0] : '') === prefix) continue
      changes.push({ from: line.from, to: line.from + had, insert: prefix })
    }
  }
  if (changes.length) view.dispatch({ changes, scrollIntoView: true })
  view.focus()
}

/** 围栏代码块:选中文字放进代码块,空选区插入模板并选中占位文本 */
export function insertCodeBlock(view: EditorView): void {
  const { state } = view
  const range = state.selection.main
  const sel = state.sliceDoc(range.from, range.to)
  const inner = sel || '代码'
  const insert = `\`\`\`\n${inner}\n\`\`\``
  const innerFrom = range.from + 4
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: { anchor: innerFrom, head: innerFrom + inner.length },
    scrollIntoView: true,
  })
  view.focus()
}

/** 3×3 表格模板,插入在光标处(独占段落) */
export function insertTable(view: EditorView): void {
  const { state } = view
  const at = state.selection.main.head
  const line = state.doc.lineAt(at)
  const prefix = line.text.trim() ? '\n\n' : ''
  const insert = `${prefix}| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n|     |     |     |\n`
  view.dispatch({
    changes: { from: at, to: at, insert },
    selection: { anchor: at + insert.length },
    scrollIntoView: true,
  })
  view.focus()
}

/** 分隔线,独占段落 */
export function insertHorizontalRule(view: EditorView): void {
  const { state } = view
  const at = state.selection.main.head
  const line = state.doc.lineAt(at)
  const prefix = line.text.trim() ? '\n\n' : ''
  const insert = `${prefix}---\n\n`
  view.dispatch({
    changes: { from: at, to: at, insert },
    selection: { anchor: at + insert.length },
    scrollIntoView: true,
  })
  view.focus()
}

/** 剪贴板:复制选中文字;空选区不动作 */
export function copySelection(view: EditorView): Promise<void> {
  const text = view.state.sliceDoc(
    view.state.selection.main.from,
    view.state.selection.main.to,
  )
  if (!text) return Promise.resolve()
  return navigator.clipboard.writeText(text)
}

/** 剪贴板:剪切 = 复制后删除选中文字 */
export function cutSelection(view: EditorView): Promise<void> {
  const { from, to } = view.state.selection.main
  if (from === to) return Promise.resolve()
  const text = view.state.sliceDoc(from, to)
  return navigator.clipboard
    .writeText(text)
    .then(() => view.dispatch({ changes: { from, to, insert: '' } }))
}

/** 剪贴板:粘贴 = 读剪贴板替换选中区 */
export function pasteClipboard(view: EditorView): Promise<void> {
  return navigator.clipboard.readText().then((text) => {
    if (!text) return
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
      scrollIntoView: true,
    })
  })
}

/** 删除选中文字 */
export function deleteSelection(view: EditorView): void {
  const { from, to } = view.state.selection.main
  if (from === to) return
  view.dispatch({ changes: { from, to, insert: '' } })
}

/** 光标所在行的标题层级(0 = 正文) */
export function currentHeadingLevel(view: EditorView): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const line = view.state.doc.lineAt(view.state.selection.main.head)
  const m = line.text.match(/^(#{1,6})\s+/)
  return (m ? m[1].length : 0) as 0 | 1 | 2 | 3 | 4 | 5 | 6
}

/** 去掉 Markdown 标记的纯文本(标题/引用/列表前缀、强调、链接、图片、围栏) */
export function simplifyMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s\[[ xX]\]\s/gm, '')
    .replace(/^\s*[-*+]\s/gm, '')
    .replace(/^\s*\d+[.)]\s/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^```.*$/gm, '')
}

/** 脚注:光标处插入 [^N] 引用,定义追加到文末(编号 = 现有定义数 + 1) */
export function insertFootnote(view: EditorView): void {
  const { state } = view
  const at = state.selection.main.head
  const n = state.doc.toString().match(/\[\^(\d+)\]:/g)?.length ?? 0
  const label = `[^${n + 1}]`
  const def = `\n\n${label}: 脚注内容`
  view.dispatch({
    changes: [
      { from: at, to: at, insert: label },
      { from: state.doc.length, to: state.doc.length, insert: def },
    ],
    selection: { anchor: at + label.length },
    scrollIntoView: true,
  })
  view.focus()
}

/** 链接引用:光标处插入 [文本][ref],定义追加到文末并选中 url 占位符 */
export function insertRefLink(view: EditorView): void {
  const { state } = view
  const range = state.selection.main
  const text = state.sliceDoc(range.from, range.to) || '链接文本'
  const insert = `[${text}][ref]`
  // selection 指事务后的文档:文末后缀 '\n\n[ref]: url' 的新起点 = 原文末
  // ± 行内插入的净偏移,占位 url 在其后偏移 9..12('url' 三个字符)
  const delta = insert.length - (range.to - range.from)
  const urlAt = state.doc.length + delta + 9
  view.dispatch({
    changes: [
      { from: range.from, to: range.to, insert },
      { from: state.doc.length, to: state.doc.length, insert: '\n\n[ref]: url' },
    ],
    selection: { anchor: urlAt, head: urlAt + 3 },
    scrollIntoView: true,
  })
  view.focus()
}

/** 公式块:$$ 围栏,独占段落,光标落在块内 */
export function insertMathBlock(view: EditorView): void {
  const { state } = view
  const at = state.selection.main.head
  const line = state.doc.lineAt(at)
  const prefix = line.text.trim() ? '\n\n' : ''
  const insert = `${prefix}$$\n\n$$\n\n`
  const inner = at + prefix.length + 3
  view.dispatch({
    changes: { from: at, to: at, insert },
    selection: { anchor: inner },
    scrollIntoView: true,
  })
  view.focus()
}

/** 内容目录:[TOC] 占位,独占段落 */
export function insertToc(view: EditorView): void {
  const { state } = view
  const at = state.selection.main.head
  const line = state.doc.lineAt(at)
  const prefix = line.text.trim() ? '\n\n' : ''
  const insert = `${prefix}[TOC]\n\n`
  view.dispatch({
    changes: { from: at, to: at, insert },
    selection: { anchor: at + insert.length },
    scrollIntoView: true,
  })
  view.focus()
}

/** YAML Front Matter 模板,插入在文档最顶部 */
export function insertYamlFrontMatter(view: EditorView): void {
  const insert = '---\ntitle: 标题\ndate: \n---\n\n'
  view.dispatch({
    changes: { from: 0, to: 0, insert },
    // selection 指事务后的文档:占位「标题」在 '---\ntitle: ' 之后(11..13)
    selection: { anchor: 11, head: 13 },
    scrollIntoView: true,
  })
  view.focus()
}

/** 在当前段落上方插入空段落(光标留在原段落开头) */
export function insertParagraphAbove(view: EditorView): void {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  let no = line.number
  while (no > 1 && state.doc.line(no - 1).text.trim()) no--
  const pos = state.doc.line(no).from
  view.dispatch({
    changes: { from: pos, to: pos, insert: '\n\n' },
    selection: { anchor: pos },
    scrollIntoView: true,
  })
  view.focus()
}

/** 在当前段落下方插入空段落(光标落在新空行) */
export function insertParagraphBelow(view: EditorView): void {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const total = state.doc.lines
  let no = line.number
  while (no < total && state.doc.line(no + 1).text.trim()) no++
  const pos = state.doc.line(no).to
  view.dispatch({
    changes: { from: pos, to: pos, insert: '\n\n' },
    selection: { anchor: pos + 2 },
    scrollIntoView: true,
  })
  view.focus()
}
