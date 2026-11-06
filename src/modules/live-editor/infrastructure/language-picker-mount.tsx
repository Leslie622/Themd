import { createRoot, type Root } from 'react-dom/client'

import { LanguagePicker } from './language-picker'

/**
 * 语言选择浮层的 DOM 桥:CodeMirror NodeView 是手工 DOM 环境,React 组件
 * 经 createRoot 挂进 header(main.tsx 同款入口)。组件本体在 language-picker.tsx
 * (拆文件仅为 react-refresh 边界)。点击语言文本时挂载,选择/关闭即卸载;
 * onClose 透传给宿主(清「已开着」引用,第二次点击才能再弹)。
 */
export function mountLanguagePicker(
  anchorEl: HTMLElement,
  onChange: (lang: string) => void,
  onClose?: () => void,
): () => void {
  const host = document.createElement('span')
  // host 本身零尺寸不挡点击;Anchor 子元素绝对定位铺满语言文本(见 language-picker.tsx)
  host.style.display = 'contents'
  anchorEl.appendChild(host)
  const root: Root = createRoot(host)
  const close = () => {
    setTimeout(() => {
      root.unmount()
      host.remove()
    }, 0)
    onClose?.()
  }
  root.render(<LanguagePicker onChange={onChange} onClose={close} />)
  return close
}
