import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme-base.css'
// 暗色模式 class 同步(store 副作用):主窗口与托盘菜单窗口都跟随同一开关
import '@/store-appearance'
// 原生滚动条统一「滚动浮现 / 静止淡出」:CM 编辑器、弹层菜单、代码块等
// 所有 ::-webkit-scrollbar 容器与 AutoHideScrollArea 的 Radix 浮动滚动条同一节奏
import { installGlobalScrollbarFade } from '@/components/scroll-visibility'

installGlobalScrollbarFade()

// 全局压掉 WebView2/浏览器的原生右键菜单(返回/刷新/打印/检查等):
// 编辑器区域由 shadcn ContextMenu 接管,其余区域不需要原生菜单;
// input/textarea 豁免,保留原生复制/粘贴。DevTools 走 F12/Ctrl+Shift+I
document.addEventListener('contextmenu', (e) => {
  const target = e.target instanceof Element ? e.target : null
  if (target?.closest('input, textarea')) return
  e.preventDefault()
})

async function bootstrap() {
  const root = document.getElementById('root')!
  // 浏览器端(npm run dev 直接开页面)没有 Tauri 内联对象,getCurrentWindow 会抛——
  // 非 Tauri 环境一律按主窗口走;窗口 label 分流只在桌面端有意义
  const windowLabel = '__TAURI_INTERNALS__' in window
    ? (await import('@tauri-apps/api/window')).getCurrentWindow().label
    : 'main'

  // 托盘菜单窗口:同一个前端包但只挂菜单组件(App 的 CodeMirror 等重依赖
  // 走动态 import,本窗口不加载),保证右键秒弹
  if (windowLabel === 'tray-menu') {
    const { default: TrayMenuWindow } = await import('@/components/TrayMenuWindow')
    createRoot(root).render(
      <StrictMode>
        <TrayMenuWindow />
      </StrictMode>,
    )
    return
  }

  // 主窗口:预取 assets 根目录与路径转换函数,图片相对路径渲染零异步。
  // 非 Tauri 环境(dev 直开页面)取不到应用数据目录,静默跳过——
  // resolver 注入前 resolveImageSrcSync 原样放行,预览显示相对路径
  const { initImageSrcResolver } = await import('@/lib/image-src')
  void initImageSrcResolver().catch(() => {})
  const { default: App } = await import('./App')
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
