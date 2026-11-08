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
 * 菜单四周为阴影预留的透明边距(px)。box-shadow/ring 画在内容布局盒之外,
 * 窗口若按内容精确取尺寸会把它们裁在窗口边外(系统投影已关,阴影只能自绘)。
 * 边距必须盖过阴影自然衰减到不可见的全程(约 2 倍 blur 半径),不够会在
 * 窗口边缘留下一圈生硬的裁切线。窗口实际按「内容 + 2×边距」取尺寸;落位时
 * 对光标做等量补偿,菜单可视盒仍保持左缘贴光标、底缘贴光标。
 */
const SHADOW_PAD = 28

/**
 * 托盘右键自绘菜单窗口(常驻隐藏的第二个 WebView,桌面端独有)。
 * Rust 托盘右键经 tray://open 通知本窗口 → 受控打开 shadcn DropdownMenu →
 * 量出内容尺寸交 Rust 落位显示。触发器钉在阴影边距处(1px 宽),
 * side=right + align=start + sideOffset=-1 让菜单内容左上角对齐边距内沿。
 */
export default function TrayMenuWindow() {
  const [open, setOpen] = useState(false)
  /** 菜单锚点 = 托盘右键的光标屏幕坐标(Rust 传回,落位用) */
  const cursorRef = useRef({ cursorX: 0, cursorY: 0 })

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
      cursorRef.current = anchor
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
          const { cursorX, cursorY } = cursorRef.current
          try {
            await platformServices.trayMenu.commitGeometry(
              cursorX - SHADOW_PAD,
              cursorY + SHADOW_PAD,
              content.offsetWidth + SHADOW_PAD * 2,
              content.offsetHeight + SHADOW_PAD * 2,
            )
          } catch {
            return
          }
          if (cancelled) return
          ro = new ResizeObserver(() => {
            const { cursorX, cursorY } = cursorRef.current
            void platformServices.trayMenu
              .resizeTrayMenu(
                cursorX - SHADOW_PAD,
                cursorY + SHADOW_PAD,
                Math.round((content.offsetWidth + SHADOW_PAD * 2) * window.devicePixelRatio),
                Math.round((content.offsetHeight + SHADOW_PAD * 2) * window.devicePixelRatio),
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
      {/* 伪触发器:仅作为 Radix 定位锚点,不可见不可交互;钉在阴影边距处,
          给菜单四周留出 box-shadow 的绘制空间(阴影画在布局盒外,窗口贴内容
          取尺寸时会被裁掉) */}
      <DropdownMenuTrigger aria-hidden tabIndex={-1} className="fixed left-7 top-7 size-px outline-none" />
      {/* w-40!:盖掉 shadcn 自带的 trigger-width 变量宽度(伪触发器只有 1px,保证菜单定宽);
          max-h-none!:禁用 Radix 按打开时视口算的可用高度钳制——视口比内容矮一丝
          (DPI 舍入)时它会触发 overflow-y-auto 出滚动条,窗口尺寸由本组件+校正通道
          保证,不需要菜单自己滚动;sideOffset=-1 抵消触发器 1px 宽,菜单左缘对齐
          28px 边距内沿;阴影双层定制(环境层柔影 + 贴合层近影),默认 shadow-lg
          对着桌面太淡;blur 20px 的衰减全程(约 2σ+偏移 ≈ 26px)落在 28px 边距内,
          到窗口边缘已衰减为零,不会出现裁切线 */}
      <DropdownMenuContent
        side="right"
        align="start"
        sideOffset={-1}
        className="w-40! max-h-none! text-xs shadow-[0_6px_20px_rgb(0_0_0/0.3),0_2px_6px_rgb(0_0_0/0.16)]"
      >
        <DropdownMenuItem className="text-xs" onSelect={() => { void platformServices.trayMenu.showMainWindow() }}>
          显示主界面
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs" variant="destructive" onSelect={() => { void platformServices.trayMenu.quitApp() }}>
          退出 Themd
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
