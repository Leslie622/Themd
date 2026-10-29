import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Copy, Minus, Square, X } from 'lucide-react'

import { isTauri } from '@/lib/theme/font-list'

const BTN_BASE = 'flex size-8 items-center justify-center rounded-md transition-colors'
// 关闭键单独一组 hover 色,避免与 hover:bg-accent 同优先级冲突导致红色失效;
// #c42b1c 是 Win11 官方规范关闭键红——窗口 chrome 刻意不走主题令牌,以贴近系统原生观感
const BTN = `${BTN_BASE} text-muted-foreground hover:bg-accent hover:text-foreground`
const BTN_CLOSE = `${BTN_BASE} text-muted-foreground hover:bg-[#c42b1c] hover:text-white`

/**
 * 窗口控制三按钮(最小化/最大化/关闭),仅 Tauri 桌面端渲染。
 * 嵌在页面顶栏右端,尺寸与工具栏按钮一致(size-8);配合 decorations: false 使用,
 * 拖拽/双击最大化由顶栏的 data-tauri-drag-region 注入脚本处理。
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isTauri()) return
    const appWindow = getCurrentWindow()
    let disposed = false
    let unlisten: (() => void) | undefined
    // 最大化状态经 resize 事件驱动(窗口最大化本身就是一次 resize)
    appWindow.onResized(async () => setMaximized(await appWindow.isMaximized())).then((fn) => {
      if (disposed) fn()
      else unlisten = fn
    })
    appWindow.isMaximized().then((v) => {
      if (!disposed) setMaximized(v)
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  if (!isTauri()) return null
  const appWindow = getCurrentWindow()

  return (
    <div className="flex items-center gap-0.5">
      {/* 与功能区拉开一杠,标示这是系统区不是应用按钮 */}
      <div className="mr-1.5 h-5 w-px bg-border" />
      <button type="button" className={BTN} aria-label="最小化" onClick={() => void appWindow.minimize()}>
        <Minus className="size-4" />
      </button>
      <button
        type="button"
        className={BTN}
        aria-label={maximized ? '向下还原' : '最大化'}
        onClick={() => void appWindow.toggleMaximize()}
      >
        {maximized ? <Copy className="size-4" /> : <Square className="size-4" />}
      </button>
      <button type="button" className={BTN_CLOSE} aria-label="关闭" onClick={() => void appWindow.close()}>
        <X className="size-4" />
      </button>
    </div>
  )
}
