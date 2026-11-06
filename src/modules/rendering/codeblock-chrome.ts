/**
 * 代码块 header 交互层(复制/换行按钮)——共享件。
 *
 * 交互层只活在应用内(渲染统一方案 I4 同款纪律):不进文档模型、不进规范
 * HTML,独立 HTML/PDF 导出天然不带,零摘除逻辑。预览面(PreviewPane 后处理)
 * 与编辑面(codeblock-cm NodeView)共用同一按钮工厂,保证两侧同构。
 *
 * 语言标签行(.themd-code-lang)是观感层,进规范 HTML——由 static-html /
 * markdown-renderer(oracle)输出,这里只负责往既有 header 行追加按钮。
 */

/** lucide Copy 图标(fill=none stroke=currentColor,转写自组件源码,逐属性核对) */
const ICON_COPY =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'

/** lucide Check */
const ICON_CHECK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'

/** lucide WrapText */
const ICON_WRAP =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><path d="m13 16 2 2 4-4"/><path d="M3 18h6"/></svg>'

/** 换行按钮切换回调(编辑面接 CM compartment,预览面接 class 切换) */
export interface CodeChromeCallbacks {
  onToggleWrap?: (wrapped: boolean) => void
}

export interface CodeChromeOptions {
  copyButton?: boolean
  wrapButton?: boolean
}

/** header 行按钮区:两个图标按钮(换行/复制)。同一 DOM 结构服务两侧。 */
export function buildCodeButtons(callbacks: CodeChromeCallbacks, options: CodeChromeOptions): HTMLElement {
  const group = document.createElement('span')
  group.className = 'themd-code-actions'

  if (options.wrapButton && callbacks.onToggleWrap) {
    const wrap = makeIconButton(ICON_WRAP, '切换自动换行')
    let wrapped = false
    wrap.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      wrapped = !wrapped
      wrap.classList.toggle('themd-code-btn-active', wrapped)
      wrap.setAttribute('aria-pressed', String(wrapped))
      callbacks.onToggleWrap?.(wrapped)
    })
    group.appendChild(wrap)
  }

  if (options.copyButton) {
    const copy = makeIconButton(ICON_COPY, '复制代码')
    copy.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const text = group.closest('.themd-code, .live-codeblock')?.querySelector('pre')?.textContent ?? ''
      copyCodeText(text, copy)
    })
    group.appendChild(copy)
  }

  return group
}

/** 复制 + 成功图标反馈(Check 1.5s),失败走 toast 定式 */
function copyCodeText(text: string, btn: HTMLButtonElement): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      btn.innerHTML = ICON_CHECK
      btn.classList.add('themd-code-btn-done')
      window.setTimeout(() => {
        btn.innerHTML = ICON_COPY
        btn.classList.remove('themd-code-btn-done')
      }, 1500)
    })
    .catch(() => {
      import('sonner').then(({ toast }) => toast.error('剪贴板操作失败'))
    })
}

function makeIconButton(icon: string, label: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'themd-code-btn'
  btn.innerHTML = icon
  btn.setAttribute('aria-label', label)
  btn.title = label
  // 防光标抢夺(任务列表勾选框定式):mousedown 不让焦点离开编辑区
  btn.addEventListener('mousedown', (e) => e.preventDefault())
  return btn
}
