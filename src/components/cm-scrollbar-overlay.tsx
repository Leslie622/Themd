import * as React from 'react'
import { holdWhileHovered, scheduleHide, showOnScroll } from '@/components/scroll-visibility'

interface ThumbGeo {
  size: number
  offset: number
}

/**
 * CodeMirror 编辑器的自绘浮动滚动条(纵向 + 横向)。
 *
 * CM 的滚动容器是内部 .cm-scroller,原生滚动条经 `scrollbar-width: none` 隐藏
 * (index.css),这里在编辑器容器上叠一层 DOM 滚动条:DOM 结构与配色槽位
 * (data-autohide / scroll-area-scrollbar / scroll-area-thumb)与 AutoHideScrollArea
 * 的 Radix 浮动滚动条完全同构——显隐时序(scroll-visibility)、静止淡出、
 * hover 加深、thumb 配色全部复用同一套 CSS,从机制上保证编辑器和其他区域的
 * 滚动条观感一致(原生 ::-webkit-scrollbar 伪元素的绘制在不同 Chromium 环境
 * 下不可控,不与 DOM 方案混用)。
 */
export function CmScrollbarOverlay({ scroller }: { scroller: HTMLElement | null }) {
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const vThumbRef = React.useRef<HTMLDivElement | null>(null)
  const hThumbRef = React.useRef<HTMLDivElement | null>(null)
  // 最新几何同时进 state(渲染)与 ref(事件回调里读,免闭包过期)
  const vGeoRef = React.useRef<ThumbGeo | null>(null)
  const hGeoRef = React.useRef<ThumbGeo | null>(null)
  const [vGeo, setVGeo] = React.useState<ThumbGeo | null>(null)
  const [hGeo, setHGeo] = React.useState<ThumbGeo | null>(null)

  // 滚动/尺寸变化 → 重算两侧 thumb 几何(比例公式与 Radix 相同)
  React.useEffect(() => {
    if (!scroller) return
    const root = rootRef.current
    if (!root) return

    const measure = () => {
      const { clientHeight, scrollHeight, clientWidth, scrollWidth } = scroller
      if (scrollHeight > clientHeight) {
        // 轨道可游走长度 = scrollbar 高度 - p-px 上下内边距
        const track = vThumbRef.current!.parentElement!.clientHeight - 2
        const size = Math.max((clientHeight / scrollHeight) * track, 12)
        const offset = (scroller.scrollTop / (scrollHeight - clientHeight)) * (track - size)
        vGeoRef.current = { size, offset }
        setVGeo({ size, offset })
      } else if (vGeoRef.current) {
        vGeoRef.current = null
        setVGeo(null)
      }
      if (scrollWidth > clientWidth) {
        const track = hThumbRef.current!.parentElement!.clientWidth - 2
        const size = Math.max((clientWidth / scrollWidth) * track, 12)
        const offset = (scroller.scrollLeft / (scrollWidth - clientWidth)) * (track - size)
        hGeoRef.current = { size, offset }
        setHGeo({ size, offset })
      } else if (hGeoRef.current) {
        hGeoRef.current = null
        setHGeo(null)
      }
    }

    const onScroll = () => {
      showOnScroll(root)
      measure()
    }
    scroller.addEventListener('scroll', onScroll, { passive: true })
    // 内容与视口尺寸变化(打字/改行宽设置/面板缩放)都会反映在这两个元素上
    const ro = new ResizeObserver(() => measure())
    ro.observe(scroller)
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild)
    measure()
    return () => {
      scroller.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [scroller])

  // 悬停保持可见 / 离开恢复淡出(隐藏态 pointer-events:none,事件穿不进来)
  React.useEffect(() => {
    if (!scroller) return
    const root = rootRef.current
    if (!root) return
    const onEnter = () => holdWhileHovered(root)
    const onLeave = () => scheduleHide(root)
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointerleave', onLeave)
    return () => {
      holdWhileHovered(root)
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointerleave', onLeave)
    }
  }, [scroller])

  // 拖拽 thumb / 点击轨道跳转
  React.useEffect(() => {
    if (!scroller) return
    const root = rootRef.current
    if (!root) return
    let drag: {
      axis: 'y' | 'x'
      grabOffset: number // 按下点相对 thumb 左/上缘的偏移
      trackRect: DOMRect
      thumbLen: number
      maxScroll: number
    } | null = null

    const axisOf = (el: Element | null): 'y' | 'x' =>
      el?.closest('[data-scrollbar-axis]')?.getAttribute('data-scrollbar-axis') === 'x' ? 'x' : 'y'

    /** 把 thumb 中心对齐到轨道上的 point 坐标,返回是否命中 */
    const seek = (axis: 'y' | 'x', point: number) => {
      const thumbEl = axis === 'y' ? vThumbRef.current : hThumbRef.current
      const geo = axis === 'y' ? vGeoRef.current : hGeoRef.current
      if (!thumbEl || !geo) return
      const trackEl = thumbEl.parentElement!
      const trackRect = trackEl.getBoundingClientRect()
      // 与 measure 同口径:扣掉 p-px 的内边距才是 thumb 可游走长度
      const travel = (axis === 'y' ? trackRect.height : trackRect.width) - 2 - geo.size
      if (travel <= 0) return
      const ratio = (point - (axis === 'y' ? trackRect.top : trackRect.left) - geo.size / 2) / travel
      const max = axis === 'y' ? scroller.scrollHeight - scroller.clientHeight : scroller.scrollWidth - scroller.clientWidth
      const next = Math.max(0, Math.min(ratio, 1)) * max
      if (axis === 'y') scroller.scrollTop = next
      else scroller.scrollLeft = next
      showOnScroll(root)
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-slot="scroll-area-scrollbar"]')) return
      e.preventDefault()
      const axis = axisOf(target)
      const thumbEl = axis === 'y' ? vThumbRef.current : hThumbRef.current
      const geo = axis === 'y' ? vGeoRef.current : hGeoRef.current
      if (!thumbEl || !geo) return
      const rect = thumbEl.getBoundingClientRect()
      drag = {
        axis,
        grabOffset: (axis === 'y' ? e.clientY - rect.top : e.clientX - rect.left),
        trackRect: thumbEl.parentElement!.getBoundingClientRect(),
        thumbLen: geo.size,
        maxScroll:
          axis === 'y'
            ? scroller.scrollHeight - scroller.clientHeight
            : scroller.scrollWidth - scroller.clientWidth,
      }
      // 点在轨道空白处:先把 thumb 中心跳到点击处,再进入拖拽
      const onThumb = target.closest('[data-slot="scroll-area-thumb"]')
      if (!onThumb) seek(axis, axis === 'y' ? e.clientY : e.clientX)
      showOnScroll(root)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!drag) return
      const travel = (drag.axis === 'y' ? drag.trackRect.height : drag.trackRect.width) - 2 - drag.thumbLen
      if (travel <= 0) return
      const point = drag.axis === 'y' ? e.clientY : e.clientX
      const moved = point - (drag.axis === 'y' ? drag.trackRect.top : drag.trackRect.left) - drag.grabOffset
      const ratio = Math.max(0, Math.min(moved / travel, 1))
      const next = ratio * drag.maxScroll
      if (drag.axis === 'y') scroller.scrollTop = next
      else scroller.scrollLeft = next
    }
    const onPointerUp = () => {
      drag = null
    }

    root.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      drag = null
      root.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [scroller])

  if (!scroller) return null

  return (
    // 根恒 pointer-events-none,点击穿透到编辑器;滚动条条本体由
    // index.css 的 [data-autohide] 规则管显隐与事件开关
    <div ref={rootRef} data-autohide="" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        data-slot="scroll-area-scrollbar"
        data-orientation="vertical"
        data-scrollbar-axis="y"
        className="absolute inset-y-0 right-0 flex w-2 touch-none p-px select-none"
      >
        <div
          ref={vThumbRef}
          data-slot="scroll-area-thumb"
          className="mx-auto w-[5px] rounded-full"
          style={{
            height: vGeo?.size,
            // thumb 游走用 transform 呈现,避免拖拽时频繁 layout
            transform: `translateY(${vGeo?.offset ?? 0}px)`,
            visibility: vGeo ? 'visible' : 'hidden',
          }}
        />
      </div>
      <div
        data-slot="scroll-area-scrollbar"
        data-orientation="horizontal"
        data-scrollbar-axis="x"
        className="absolute inset-x-0 bottom-0 flex h-2 touch-none flex-col p-px select-none"
      >
        <div
          ref={hThumbRef}
          data-slot="scroll-area-thumb"
          className="my-auto h-[5px] rounded-full"
          style={{
            width: hGeo?.size,
            transform: `translateX(${hGeo?.offset ?? 0}px)`,
            visibility: hGeo ? 'visible' : 'hidden',
          }}
        />
      </div>
    </div>
  )
}
