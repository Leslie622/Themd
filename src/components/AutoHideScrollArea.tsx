import * as React from 'react'
import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui'
import { ScrollBar } from '@/components/ui/scroll-area'
import { holdWhileHovered, scheduleHide, showOnScroll } from '@/components/scroll-visibility'
import { cn } from '@/lib/utils'

type RootProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root>

export interface AutoHideScrollAreaProps extends RootProps {
  /** 真正的滚动元素是 Radix Viewport 而非 Root——滚动位置、同步滚动、背景样式要挂它身上 */
  viewportRef?: React.Ref<HTMLDivElement>
  viewportProps?: React.ComponentPropsWithoutRef<'div'>
}

/**
 * shadcn ScrollArea 的「滚动浮现 / 静止淡出」行为包装(主流 overlay 滚动条):
 * Radix 自带浮动 thumb 与原生滚动条隐藏,这里只补显隐时序——
 * 滚动即点亮,静止后淡出;hover 不点亮(不滚动就不出现),
 * 可见期间把指针放到滚动条上则保持,可抓取拖拽。
 * 时序逻辑在 scroll-visibility.ts,与原生滚动条(CM 编辑器等)共用同一套。
 */
export function AutoHideScrollArea({
  className,
  children,
  viewportRef,
  viewportProps,
  ...rootProps
}: AutoHideScrollAreaProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const viewport = root.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')
    const scrollbar = root.querySelector<HTMLElement>('[data-slot="scroll-area-scrollbar"]')
    if (!viewport) return
    const onScroll = () => showOnScroll(root)
    // 滚动条空闲时 pointer-events:none,悬停穿透到内容不会误保持;
    // 点亮后才收得到 enter/leave——离开即恢复淡出计时
    const onEnter = () => holdWhileHovered(root)
    const onLeave = () => scheduleHide(root)
    viewport.addEventListener('scroll', onScroll, { passive: true })
    scrollbar?.addEventListener('pointerenter', onEnter)
    scrollbar?.addEventListener('pointerleave', onLeave)
    return () => {
      holdWhileHovered(root)
      viewport.removeEventListener('scroll', onScroll)
      scrollbar?.removeEventListener('pointerenter', onEnter)
      scrollbar?.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <ScrollAreaPrimitive.Root
      ref={rootRef}
      // type="always":Radix 层不参与显隐(Hover/Auto 变体的 Presence 门控依赖
      // 指针事件与 ResizeObserver 时序,且 forceMount 传不穿两层),滚动条常驻,
      // 显隐时序完全由下方 osb-active 的 opacity 控制
      type="always"
      data-autohide=""
      className={cn('relative overflow-hidden', className)}
      {...rootProps}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        {...viewportProps}
        className={cn(
          'size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1',
          viewportProps?.className,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {/* forceMount 兜底 thumb 的 Presence 门控;宽度收到 8px 对齐全局原生滚动条(轨 8px/thumb 可见 6px) */}
      <ScrollBar forceMount className="data-vertical:w-2! data-horizontal:h-2!" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}
