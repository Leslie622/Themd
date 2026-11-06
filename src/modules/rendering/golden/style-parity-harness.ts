/**
 * 样式一致性 harness(渲染统一第 4 步,方案 §7「编辑面 computed-style diff」)。
 *
 * 在同一页面挂两个隐藏容器(同 .themd-prose、同主题令牌):
 *   静态面 = renderStaticHtml(金样语料);编辑面 = 真实 TipTap Editor 实例。
 * 按契约规范选择器配对,逐元素 diff computed style——发现方式从「用户截图」
 * 变成「数字清单」。按选择器配对(而非树游走)天然容纳 PM 内容模型差异
 * (如任务项宽松形态 input 在 p 内、静态紧凑形态 input 在 li 内)。
 *
 * 运行(dev server 起着时,浏览器控制台或自动化 evaluate):
 *   const m = await import('/src/modules/rendering/golden/style-parity-harness.ts')
 *   const r = await m.runStyleParity()
 * 本模块不被应用代码引用,不进产物;纯 dev 验收工具。
 */
import { Editor } from '@tiptap/core'

import corpus from './corpus.md?raw'
import { getMarkdownManager } from '@/modules/live-editor/infrastructure/markdown-engine'
import { liveExtensions } from '@/modules/live-editor/infrastructure/tiptap-setup'
import { renderStaticHtml } from '../static-html'

/** 契约规范选择器:两容器内逐一配对(计数不等记为结构差异)。
 *  p 排除列表/表格内的段(PM 内容模型恒为段落,紧凑形态无 p——
 *  那些位置由 li/td/input 配对与继承覆盖);标记类只比「职责属性」,
 *  继承方向差异(如 ***x*** 的 em>strong vs strong>em 嵌套序)不算差。 */
const SELECTORS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // 语料内挂账排除(清账即删):div.custom-block p 是内嵌 HTML 透传里的真 p
  // (编辑面按 I4 设计显示源码不渲染,raw HTML 族挂账)
  'p:not(li p):not(td p):not(th p):not(div.custom-block p):not(svg p):not(foreignObject p)',
  'p.katex-block',
  '.themd-mermaid',
  'ul', 'ol', 'li',
  'li.task-list-item',
  'input.task-list-item-checkbox',
  '.themd-callout', '.themd-callout-title', '.themd-callout > p:last-child',
  'blockquote', 'table', 'tr', 'th', 'td',
  'hr', 'a', 'strong', 'em', 's', 'code', 'pre',
] as const

/** 跨侧配对:编辑面私有容器 ↔ 静态规范容器(CM 族镀层审查的量化手段) */
const CROSS_PAIRS: ReadonlyArray<{
  label: string
  liveSel: string
  staticSel: string
  props?: readonly string[]
}> = [
  {
    label: 'CM 代码块外壳(pre.live-codeblock ↔ pre)',
    liveSel: 'pre.live-codeblock',
    staticSel: 'pre',
  },
  {
    label: 'CM 代码文本(.cm-content ↔ pre>code)',
    liveSel: 'pre.live-codeblock .cm-content',
    staticSel: 'pre > code',
    // white-space 长手对 contenteditable 的计算值序列化口径不可信
    // (2026-11-03 几何探针已证行为一致),折行行为由 wrapProbe 长行几何把关
    props: ['font-family', 'font-size', 'line-height', 'color'],
  },
  {
    // 2026-11-06 代码块 header 改版:语言标签行是观感层,进规范 HTML
    // (NodeView header 镀层 ↔ 静态 .themd-code-lang,两侧同构)
    label: '代码块 header 行(.themd-code-lang ↔ .themd-code-lang)',
    liveSel: '.themd-code > .themd-code-lang',
    staticSel: '.themd-code-lang',
  },
  {
    label: '代码块规范包装(.themd-code ↔ .themd-code)',
    liveSel: '.themd-code.live-codeblock-wrapper',
    staticSel: '.themd-code',
  },
]

/** 标记类职责属性:只比该标记自己负责的样式,继承来的不比 */
const MARK_PROPS: Record<string, readonly string[]> = {
  strong: ['font-weight'],
  em: ['font-style'],
  s: ['text-decoration-line'],
  a: ['color', 'text-decoration-line'],
  code: ['font-family', 'font-size', 'color', 'background-color',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-left-radius', 'border-bottom-right-radius'],
}

/** diff 的属性集:字体/字号/行高/颜色/四向边距与边框/圆角/对齐 */
const PROPS = [
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
  'color', 'background-color',
  'text-decoration-line', 'text-align', 'vertical-align',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-color', 'border-bottom-color',
  'border-top-left-radius', 'border-bottom-right-radius',
] as const

/** I4 固有结构豁免(永久,非挂账):编辑面规范结构的合法偏离,不计违规。
 *  来源两类:① CM 代码块内部行结构(.cm-line/div 而非 code,镀层正统);
 *  ② raw HTML 块/行内源码态显示(编辑面按解析保真政策①显示源码,静态侧透传)。 */
const I4_INHERENT = [
  /^pre: /, // ① CM 内嵌 + ② raw HTML 块级源码态(pre.live-raw-html)
  /^code: /, // ① CM 无 code 元素 + ② raw HTML 源码态 code
]

export interface StyleDiff {
  selector: string
  index: number
  prop: string
  live: string
  staticSide: string
}

export interface StyleParityReport {
  pairs: number
  diffs: StyleDiff[]
  structural: string[]
  /** I4 固有豁免(CM 内部结构 / raw HTML 源码态),单列不计违规 */
  known: string[]
  /** 长行折行几何探针:两侧必须同为「不折行 · 横向溢出」 */
  wrapProbe: { liveOverflow: boolean; staticOverflow: boolean; match: boolean }
  /** 调试:计数不等选择器的两侧文本清单(withTexts 时填充) */
  texts?: Record<string, { live: string[]; staticSide: string[] }>
}

export async function runStyleParity(
  opts?: { selectors?: readonly string[]; withTexts?: boolean },
): Promise<StyleParityReport> {
  const host = document.createElement('div')
  // 离屏但参与布局(position:fixed 左外),computed style 才有真实值
  host.style.cssText = 'position:fixed;left:-99999px;top:0;width:820px;'
  document.body.appendChild(host)

  // 主题令牌:拷当前应用里任一 .themd-prose 的内联变量(预览或编辑面任一在场即可)
  const existing = document.querySelector<HTMLElement>('.themd-prose')
  const varsStyle = existing?.getAttribute('style') ?? ''

  const staticEl = document.createElement('article')
  staticEl.className = 'themd-prose'
  staticEl.setAttribute('style', varsStyle)
  staticEl.innerHTML = renderStaticHtml(corpus)
  host.appendChild(staticEl)

  const liveEl = document.createElement('article')
  liveEl.className = 'themd-prose'
  liveEl.setAttribute('style', varsStyle)
  host.appendChild(liveEl)
  const editor = new Editor({
    element: liveEl,
    extensions: [...liveExtensions()],
    content: getMarkdownManager().parse(corpus),
  })
  // 等挂载与 NodeView 初始化
  await new Promise((resolve) => setTimeout(resolve, 120))

  const diffs: StyleDiff[] = []
  const structural: string[] = []
  const known: string[] = []
  const texts: Record<string, { live: string[]; staticSide: string[] }> = {}
  let pairs = 0

  for (const selector of opts?.selectors ?? SELECTORS) {
    const liveNodes = [...liveEl.querySelectorAll(selector)]
    const staticNodes = [...staticEl.querySelectorAll(selector)]
    if (liveNodes.length !== staticNodes.length) {
      const line = `${selector}: 数量 live=${liveNodes.length} ≠ static=${staticNodes.length}(${describe(liveNodes[0])} vs ${describe(staticNodes[0])})`
      if (I4_INHERENT.some((re) => re.test(line))) known.push(line)
      else structural.push(line)
      if (opts?.withTexts) {
        texts[selector] = {
          live: liveNodes.map((n) => n.textContent?.slice(0, 40) ?? ''),
          staticSide: staticNodes.map((n) => n.textContent?.slice(0, 40) ?? ''),
        }
      }
      continue
    }
    // 标记类只比职责属性(:last-child 形态等含伪类的选择器取基础名)
    const markKey = selector.replace(/:last-child.*$/, '')
    const props = MARK_PROPS[markKey] ?? PROPS
    liveNodes.forEach((liveNode, i) => {
      const staticNode = staticNodes[i]
      pairs++
      const a = getComputedStyle(liveNode) as unknown as Record<string, string>
      const b = getComputedStyle(staticNode) as unknown as Record<string, string>
      for (const prop of props) {
        if (a[prop] !== b[prop]) {
          diffs.push({ selector, index: i, prop, live: a[prop], staticSide: b[prop] })
        }
      }
    })
  }

  // 跨侧配对(CM 族镀层审查)
  for (const pair of CROSS_PAIRS) {
    const liveNodes = [...liveEl.querySelectorAll(pair.liveSel)]
    const staticNodes = [...staticEl.querySelectorAll(pair.staticSel)]
    if (liveNodes.length !== staticNodes.length) {
      const line = `${pair.label}: 数量 live=${liveNodes.length} ≠ static=${staticNodes.length}`
      if (I4_INHERENT.some((re) => re.test(line))) known.push(line)
      else structural.push(line)
      continue
    }
    const props = pair.props ?? PROPS
    liveNodes.forEach((liveNode, i) => {
      const staticNode = staticNodes[i]
      pairs++
      const a = getComputedStyle(liveNode) as unknown as Record<string, string>
      const b = getComputedStyle(staticNode) as unknown as Record<string, string>
      for (const prop of props) {
        if (a[prop] !== b[prop]) {
          diffs.push({ selector: pair.label, index: i, prop, live: a[prop], staticSide: b[prop] })
        }
      }
    })
  }

  // 探针在配对测量之后跑:插入的节点不污染选择器计数
  const wrapProbe = measureWrapProbe(editor, liveEl, staticEl)

  editor.destroy()
  host.remove()
  return { pairs, diffs, structural, known, wrapProbe, ...(opts?.withTexts ? { texts } : {}) }
}

/**
 * 折行行为几何探针(2026-11-03 text-wrap-mode 挂账的清账手段):
 * Chromium 对 contenteditable 的 text-wrap-mode 计算值序列化不可信
 * (author 规则明写 nowrap 仍报 wrap),计算值比对退役,改为行为级测量——
 * 两侧各插一根 600 字符长行,「不折行」判定 = 容器横向溢出。
 * 设计契约:静态 pre 靠 UA white-space:pre 不折行,CM 侧 textWrapMode:nowrap
 * 钉死,两侧都必须溢出(不折行)。
 */
function measureWrapProbe(
  editor: Editor,
  liveEl: HTMLElement,
  staticEl: HTMLElement,
): { liveOverflow: boolean; staticOverflow: boolean; match: boolean } {
  const LONG = 'x'.repeat(600)
  const schema = editor.state.schema
  const probeNode = schema.nodes.codeBlock.create({ language: null }, schema.text(LONG))
  editor.commands.insertContentAt(editor.state.doc.content.size, probeNode)
  const probePre = document.createElement('pre')
  probePre.appendChild(document.createElement('code')).textContent = LONG
  staticEl.appendChild(probePre)

  const cmPres = [...liveEl.querySelectorAll('pre.live-codeblock')]
  const cmScroller = cmPres[cmPres.length - 1]?.querySelector<HTMLElement>('.cm-scroller')
  const liveOverflow = !!cmScroller && cmScroller.scrollWidth > cmScroller.clientWidth + 1
  const staticOverflow = probePre.scrollWidth > probePre.clientWidth + 1
  return { liveOverflow, staticOverflow, match: liveOverflow && staticOverflow }
}

function describe(el: Element | undefined): string {
  if (!el) return '(无)'
  return `<${el.tagName.toLowerCase()}${el.className ? ` class="${el.className}"` : ''}>`
}
