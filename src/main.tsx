import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme-base.css'
import { initImageSrcResolver } from './lib/image-src'
import App from './App.tsx'

// 桌面端预取 assets 根目录与路径转换函数,图片相对路径渲染零异步
void initImageSrcResolver()

// 全局压掉 WebView2/浏览器的原生右键菜单(返回/刷新/打印/检查等):
// 编辑器区域由 shadcn ContextMenu 接管,其余区域不需要原生菜单;
// input/textarea 豁免,保留原生复制/粘贴。DevTools 走 F12/Ctrl+Shift+I
document.addEventListener('contextmenu', (e) => {
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest('input, textarea')) return
  e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
