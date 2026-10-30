import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme-base.css'
import { initImageSrcResolver } from './lib/image-src'
import App from './App.tsx'

// 桌面端预取 assets 根目录与路径转换函数,图片相对路径渲染零异步
void initImageSrcResolver()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
