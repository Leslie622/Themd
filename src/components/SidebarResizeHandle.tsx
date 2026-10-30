import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'

interface SidebarResizeHandleProps {
  /** 侧栏容器节点:拖拽期间直接改它的 style.width,完全绕开 React 渲染 */
  targetRef: RefObject<HTMLDivElement | null>
  min: number
  max: number
  /** 手势结束时提交一次(此时才进 React 状态并持久化) */
  onCommit: (width: number) => void
  /** 双击恢复默认宽度 */
  onReset: () => void
}

/**
 * 侧栏自绘拖拽条。侧栏不参与 react-resizable-panels 的百分比引擎,
 * 宽度由普通 CSS 像素值保证,窗口缩放零 JS 参与不抖动。
 * 拖拽性能:逐条 pointermove 若走 setState 会以事件频率重渲染整棵树,
 * 这里改为 rAF 合并后直写目标节点 style.width,松手才提交一次状态。
 */
export function SidebarResizeHandle({ targetRef, min, max, onCommit, onReset }: SidebarResizeHandleProps) {
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ pointerX: 0, startWidth: 0 })
  const frame = useRef<number | null>(null)
  const pendingWidth = useRef(0)

  const clamp = useCallback((px: number) => Math.min(max, Math.max(min, px)), [min, max])

  const applyWidth = useCallback(
    (px: number) => {
      pendingWidth.current = px
      if (frame.current != null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        if (targetRef.current) targetRef.current.style.width = `${pendingWidth.current}px`
      })
    },
    [targetRef],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      // 起点以 DOM 实际宽度为准,不依赖任何 React 状态
      dragStart.current = {
        pointerX: event.clientX,
        startWidth: targetRef.current?.getBoundingClientRect().width ?? min,
      }
      setDragging(true)
    },
    [targetRef, min],
  )

  useEffect(() => {
    if (!dragging) return
    const deltaWidth = (event: PointerEvent) =>
      clamp(dragStart.current.startWidth + event.clientX - dragStart.current.pointerX)
    const onMove = (event: PointerEvent) => applyWidth(deltaWidth(event))
    const finish = (event: PointerEvent) => {
      if (frame.current != null) {
        cancelAnimationFrame(frame.current)
        frame.current = null
      }
      const final = deltaWidth(event)
      // 松手同步直写,防止最后一次 rAF 被取消后宽度回跳一格
      if (targetRef.current) targetRef.current.style.width = `${final}px`
      setDragging(false)
      onCommit(final)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    // 拖拽期间锁定光标与禁选,指针移出拖拽条也保持反馈
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, clamp, applyWidth, onCommit, targetRef])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="调整侧栏宽度"
      data-dragging={dragging || undefined}
      onPointerDown={handlePointerDown}
      onDoubleClick={onReset}
      className="group relative flex w-1.5 shrink-0 cursor-col-resize select-none items-center justify-center"
      style={{ touchAction: 'none' }}
    >
      {/* 1px 视觉线 + 中央把手,与原 react-resizable-panels 外观一致 */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-foreground/20 group-data-[dragging]:bg-primary/50" />
      <div className="h-6 w-1 rounded-lg bg-border transition-colors group-hover:bg-foreground/25 group-data-[dragging]:bg-primary/60" />
    </div>
  )
}
