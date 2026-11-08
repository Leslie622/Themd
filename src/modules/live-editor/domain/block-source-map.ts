/**
 * 块级 source-map:把 Markdown 原文切成顶层块,建立「块原文」映射(纯函数,domain 层)。
 *
 * 实时预览 v2(ProseMirror 双引擎)的字节保真基石:
 * - 未被用户编辑的块,保存时逐字节吐回原文(watcher 回声抑制依赖逐字节一致)
 * - 只有 dirty 块才经 ProseMirror 序列化重新生成
 *
 * 切分规则(文本级,不解析语法):
 * - 空行 = 块边界;连续非空行归为一块(段落/标题/列表/引用/表格一视同仁)
 * - 围栏代码块(```/~~~)内部的空行不切分,整块吞入
 * - 文档首行 `---` 视为 front matter,直到闭合 `---` 整体一块
 * - 围栏可以打断段落(CommonMark 语义):段落后紧跟 ``` 开新块
 * - 块间空行(含换行符)记入前块的 separator,重组 = Σ(text + separator) 逐字节还原
 *
 * 已知取舍(P3 细化):宽松列表/缩进代码块内部的空行会把一个语法块切成多个
 * sourceMap 块——对未编辑块无影响(各块原文照吐),只影响被编辑块的序列化
 * 粒度,语义由后续「块组」pass 收紧。
 */

/** 一个顶层块:from/to 为原文偏移,text 含块内全部换行,separator 为块后空行尾巴 */
export interface BlockRecord {
  from: number
  to: number
  text: string
  separator: string
  /** 用户编辑命中过即置 true;序列化时 dirty 块走 PM 管线 */
  dirty: boolean
}

/** 围栏开启信息:代码围栏(char/length 对)或公式围栏($$ 对) */
interface FenceState {
  kind: 'code' | 'math'
  char: '`' | '~'
  length: number
}

/** 解析 pos 起的一行:text 不含终止符,term 为 '\r\n' | '\n' | ''(EOF 无换行) */
function readLine(content: string, pos: number): { text: string; term: string; next: number } {
  const nl = content.indexOf('\n', pos)
  if (nl === -1) return { text: content.slice(pos), term: '', next: content.length }
  const raw = content.slice(pos, nl)
  // \r\n:回车属于终止符,不属于行文本
  return raw.endsWith('\r')
    ? { text: raw.slice(0, -1), term: '\r\n', next: nl + 1 }
    : { text: raw, term: '\n', next: nl + 1 }
}

const FRONT_MATTER_LINE = /^---[ \t]*$/

/** 行首围栏检测(≤3 空格缩进;反引号围栏的 info 串不得含反引号;$$ 公式围栏) */
function fenceOpen(text: string): FenceState | null {
  // 公式围栏:行首 $$(单行自闭合形式 $$x$$ 由闭合检测的「非开启行」规则兜住)
  if (/^ {0,3}\$\$/.test(text)) return { kind: 'math', char: '~', length: 0 }
  const m = /^ {0,3}(`{3,}|~{3,})/.exec(text)
  if (!m) return null
  const mark = m[1]
  const char = mark[0] as '`' | '~'
  if (char === '`' && text.includes('`', m[0].length)) return null
  return { kind: 'code', char, length: mark.length }
}

/** 围栏闭合:代码围栏同字符整行(开启行自身永不闭合);公式围栏行尾 $$,开启行仅单行自闭合 */
function fenceClose(text: string, fence: FenceState, isOpenLine: boolean): boolean {
  if (fence.kind === 'math') {
    if (isOpenLine) return /^ {0,3}\$\$.+\$\$\s*$/.test(text) // 单行自闭合
    return text.trimEnd().endsWith('$$')
  }
  if (isOpenLine) return false
  const m = new RegExp(`^ {0,3}\\${fence.char}{${fence.length},}[ \\t]*$`).exec(text)
  return m !== null
}

/**
 * 切分顶层块。空内容返回 [];全文皆空行/以空行开头时,用一个 text='' 的
 * 前导伪块承载文档头部空行,保证 joinBlocks 逐字节还原。
 */
export function splitBlocks(content: string): BlockRecord[] {
  type Raw = { from: number; to: number }
  const raws: Raw[] = []
  const N = content.length
  let i = 0
  let blockFrom = -1
  let blockTo = -1
  let fence: FenceState | null = null
  let inFrontMatter = false
  let sawContent = false

  const closeBlock = (to: number) => {
    if (blockFrom === -1) return
    raws.push({ from: blockFrom, to })
    blockFrom = -1
  }

  while (i < N) {
    const { text, next } = readLine(content, i)
    const blank = /^[ \t]*$/.test(text)

    if (!sawContent && i === 0 && FRONT_MATTER_LINE.test(text)) {
      // front matter:从首行 --- 到闭合 --- 整体一块(空行不切分)
      inFrontMatter = true
      blockFrom = i
      blockTo = next
      i = next
      sawContent = true
      continue
    }
    if (inFrontMatter) {
      blockTo = next
      if (FRONT_MATTER_LINE.test(text)) inFrontMatter = false
      i = next
      continue
    }
    if (fence) {
      // 围栏内一切行(含空行)都属当前块;闭合行属块尾
      // (能进到这里说明开启行已被消化,当前行不是开启行)
      if (fenceClose(text, fence, false)) fence = null
      blockTo = next
      i = next
      sawContent = true
      continue
    }
    if (blank) {
      // 块边界:空行起进入 separator 区
      closeBlock(blockTo)
      i = next
      continue
    }
    const open = fenceOpen(text)
    if (open && blockFrom !== -1) {
      // 围栏打断段落:当前块在上一行尾闭合(to = 本行起点),围栏开新块
      closeBlock(i)
      fence = open
      // 单行自闭合($$x$$):开启即闭合,不再延续围栏
      if (fenceClose(text, open, true)) fence = null
      blockFrom = i
      blockTo = next
    } else {
      if (open) {
        fence = open
        if (fenceClose(text, open, true)) fence = null
      }
      if (blockFrom === -1) blockFrom = i
      blockTo = next
    }
    sawContent = true
    i = next
  }
  closeBlock(blockTo)

  // 前导空行:补一个 text='' 伪块承载
  if (raws.length > 0 && raws[0].from > 0) {
    raws.unshift({ from: 0, to: 0 })
  }
  // 全文皆空行/空内容:单伪块承载
  if (raws.length === 0 && N > 0) {
    raws.push({ from: 0, to: 0 })
  }

  return raws.map((r, idx) => {
    const nextFrom = idx + 1 < raws.length ? raws[idx + 1].from : N
    return {
      from: r.from,
      to: r.to,
      text: content.slice(r.from, r.to),
      separator: content.slice(r.to, nextFrom),
      dirty: false,
    }
  })
}

/** 重组:Σ(text + separator),与 splitBlocks 互逆,用于守门测试 */
export function joinBlocks(blocks: BlockRecord[]): string {
  return blocks.map((b) => b.text + b.separator).join('')
}

/** 标记命中区间 [from, to) 的块为 dirty(仅供守门测试模拟编辑;生产路径
 *  由 reconcileBlocks 在重对账时标脏,偏移为 content 坐标) */
export function markDirty(blocks: BlockRecord[], from: number, to: number): BlockRecord[] {
  return blocks.map((b) =>
    b.from < to && from < b.to + b.separator.length && !b.dirty ? { ...b, dirty: true } : b,
  )
}
