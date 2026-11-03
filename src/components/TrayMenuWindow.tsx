import { useEffect, useRef, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { platformServices } from '@/app/platform'

/**
 * 托盘右键自绘菜单窗口(常驻隐藏的第二个 WebView,桌面端独有)。
 * Rust 托盘右键经 tray://open 通知本窗口 → 受控打开 shadcn DropdownMenu →
 * 量出内容尺寸交 Rust 落位显示。零尺寸触发器钉在窗口左上角,
 * side=right + align=start 让菜单内容从窗口 (0,0) 铺开——窗口即菜单。
 */
export default function TrayMenuWindow() {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef({ cursorX: 0, cursorY: 0 })

  useEffect(() => {
    // 透明窗口:全局样式给 body 上的底色会挡住菜单圆角外的桌面,压成透明
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    document.body.style.overflow = 'hidden'
  }, [])

  useEffect(() => {
    let offOpen: (() => void) | null = null
    let offBlur: (() => void) | null = null
    void platformServices.trayMenu.onOpenRequest((anchor) => {
      anchorRef.current = anchor
      setOpen(true)
    }).then((off) => { offOpen = off })
    void platformServices.trayMenu.onBlur(() => {
      // 点窗口外:Rust 已藏窗口,这里同步收菜单态,下次打开重新走量尺寸流程
      setOpen(false)
    }).then((off) => { offBlur = off })
    return () => { offOpen?.(); offBlur?.() }
  }, [])

  // 菜单挂载后量实际尺寸交 Rust 落位:双 rAF 等布局稳定;offsetWidth/Height
  // 是布局尺寸,不受弹入缩放动画(transform)影响。落位显示后再挂 ResizeObserver
  // 校正:Rust 侧显示器缩放估计可能与 WebView 实际渲染缩放不一致(高 DPI 屏,
  // 估计偏小会裁掉菜单底部),而窗口显示后已在目标显示器上,window.devicePixelRatio
  // 必准——按它换算物理像素纠正一次;observe 本身立即回调一次,之后持续跟随
  // 内容尺寸变化。窗口已隐藏(失焦被藏)时命令侧直接拒绝,不会复活菜单。
  useEffect(() => {
    if (!open) return
    let ro: ResizeObserver | null = null
    let cancelled = false
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const content = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')
        if (!content || cancelled) return
        const commit = async () => {
          const { cursorX, cursorY } = anchorRef.current
          try {
            await platformServices.trayMenu.commitGeometry(
              cursorX,
              cursorY,
              content.offsetWidth,
              content.offsetHeight,
            )
          } catch {
            return
          }
          if (cancelled) return
          ro = new ResizeObserver(() => {
            const { cursorX, cursorY } = anchorRef.current
            void platformServices.trayMenu
              .resizeTrayMenu(
                cursorX,
                cursorY,
                Math.round(content.offsetWidth * window.devicePixelRatio),
                Math.round(content.offsetHeight * window.devicePixelRatio),
              )
              .catch(() => {})
          })
          ro.observe(content)
        }
        void commit()
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [open])

  /** 收回菜单并藏窗口(Rust 侧失焦也会藏,这里覆盖 Esc / 选中菜单项路径) */
  const dismiss = () => {
    setOpen(false)
    void platformServices.trayMenu.close()
  }

  return (
    <DropdownMenu open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      {/* 伪触发器:仅作为 Radix 定位锚点,不可见不可交互 */}
      <DropdownMenuTrigger aria-hidden tabIndex={-1} className="fixed left-0 top-0 size-px outline-none" />
      {/* w-48!:盖掉 shadcn 自带的 trigger-width 变量宽度(伪触发器只有 1px,保证菜单定宽);
          max-h-none!:禁用 Radix 按打开时视口算的可用高度钳制——视口比内容矮一丝
          (DPI 舍入)时它会触发 overflow-y-auto 出滚动条,窗口尺寸由本组件+校正通道
          保证,不需要菜单自己滚动 */}
      <DropdownMenuContent side="right" align="start" sideOffset={0} className="w-48! max-h-none!">
        <DropdownMenuItem onSelect={() => { void platformServices.trayMenu.showMainWindow() }}>
          显示主界面
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => { void platformServices.trayMenu.quitApp() }}>
          退出 Themd
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
