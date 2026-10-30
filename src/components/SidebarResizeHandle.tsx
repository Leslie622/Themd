import { useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'

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
 *
 * 样式与 shadcn ResizableHandle(components/ui/resizable.tsx,withHandle 形态)
 * 完全一致:1px bg-border 线 + after 伪元素 4px 热区 + 中央把手圆条。
 * shadcn 默认没有 hover 变色,一致地只以 col-resize 光标提示;布局宽度同为 1px。
 *
 * 拖拽性能:逐条 pointermove 若走 setState 会以事件频率重渲染整棵树,
 * 这里 rAF 合并后直写目标节点 style.width,松手才提交一次状态。
 */
export function SidebarResizeHandle({ targetRef, min, max, onCommit, onReset }: SidebarResizeHandleProps) {
  const frame = useRef<number | null>(null)

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const startX = event.clientX
    // 起点以 DOM 实际宽度为准,不依赖任何 React 状态
    const startWidth = targetRef.current?.getBoundingClientRect().width ?? min
    const clamp = (px: number) => Math.min(max, Math.max(min, px))
    let pendingWidth = startWidth

    const onMove = (moveEvent: PointerEvent) => {
      pendingWidth = clamp(startWidth + moveEvent.clientX - startX)
      if (frame.current != null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        if (targetRef.current) targetRef.current.style.width = `${pendingWidth}px`
      })
    }
    const finish = (upEvent: PointerEvent) => {
      if (frame.current != null) {
        cancelAnimationFrame(frame.current)
        frame.current = null
      }
      const final = clamp(startWidth + upEvent.clientX - startX)
      // 松手同步直写,防止最后一次 rAF 被取消后宽度回跳一格
      if (targetRef.current) targetRef.current.style.width = `${final}px`
      cleanup()
      onCommit(final)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    // 拖拽期间锁定光标与禁选,指针移出拖拽条也保持反馈
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  /** 键盘微调,对齐库 Separator 的键盘可操作性 */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const current = targetRef.current?.getBoundingClientRect().width ?? min
    const next = Math.min(max, Math.max(min, current + (event.key === 'ArrowRight' ? 16 : -16)))
    if (targetRef.current) targetRef.current.style.width = `${next}px`
    onCommit(next)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="调整侧栏宽度"
      tabIndex={0}
      data-slot="resizable-handle"
      onPointerDown={handlePointerDown}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      /* 类名与 components/ui/resizable.tsx 的 Separator 逐字一致(省略库托管的水平变体),
         仅补 shrink-0——shadcn 形态下由库注入。静止光标同 shadcn 为默认箭头,
         拖拽中才全局切 col-resize(pointerdown 时写 body.cursor,与库行为一致) */
      className="bg-border focus-visible:ring-1 focus-visible:ring-ring relative flex w-px shrink-0 items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-hidden"
      style={{ touchAction: 'none' }}
    >
      <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
    </div>
  )
}
