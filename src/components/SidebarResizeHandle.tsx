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

type SeparatorState = 'inactive' | 'hover' | 'active'

/**
 * 水平拖拽光标,移植库的内部逻辑:Chromium/Gecko 上 ew-resize 渲染为
 * 系统标准「左右箭头」,WebKit 上该字形异常故回落 col-resize。
 * 与库相同的选择,保证两条分隔线光标字形逐像素一致。
 */
let cursorCache: string | undefined
function horizontalResizeCursor(): string {
  if (cursorCache === undefined) {
    const ua = typeof window !== 'undefined' ? window.navigator.userAgent : ''
    cursorCache = ua.includes('Chrome') || ua.includes('Firefox') ? 'ew-resize' : 'col-resize'
  }
  return cursorCache
}

/**
 * 侧栏自绘拖拽条。侧栏不参与 react-resizable-panels 的百分比引擎,
 * 宽度由普通 CSS 像素值保证,窗口缩放零 JS 参与不抖动。
 *
 * 样式与 shadcn ResizableHandle(components/ui/resizable.tsx,withHandle 形态)
 * 完全一致:1px bg-border 线 + after 伪元素 4px 热区 + 中央把手圆条。
 * hover/active 行为对齐库的 Separator:hover 时 data-separator="hover" +
 * 平台对应的全局拖拽光标(库经 adoptedStyleSheets 注入 *:hover 规则实现),
 * 拖拽中变 "active",均直写 DOM 不触发 React 渲染。
 */
export function SidebarResizeHandle({ targetRef, min, max, onCommit, onReset }: SidebarResizeHandleProps) {
  const frame = useRef<number | null>(null)
  const elementRef = useRef<HTMLDivElement | null>(null)

  const setState = (state: SeparatorState) => {
    if (elementRef.current) elementRef.current.dataset.separator = state
  }

  /** 与库一致:hover/active 期间全局锁定光标,离开/松手恢复 */
  const setGlobalCursor = (cursor: string | null) => {
    document.body.style.cursor = cursor ?? ''
    document.body.style.userSelect = cursor ? 'none' : ''
  }

  const resizeCursor = horizontalResizeCursor()

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setState('active')
    setGlobalCursor(resizeCursor)
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
      // 指针仍在线上则回到 hover,否则 inactive(与库状态机一致)
      const rect = elementRef.current?.getBoundingClientRect()
      const stillInside = rect && upEvent.clientX >= rect.left && upEvent.clientX <= rect.right
      setState(stillInside ? 'hover' : 'inactive')
      setGlobalCursor(null)
      onCommit(final)
    }
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  const handlePointerEnter = () => {
    if (elementRef.current?.dataset.separator !== 'active') {
      setState('hover')
      setGlobalCursor(resizeCursor)
    }
  }

  const handlePointerLeave = () => {
    if (elementRef.current?.dataset.separator !== 'active') {
      setState('inactive')
      setGlobalCursor(null)
    }
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
      ref={elementRef}
      role="separator"
      aria-orientation="vertical"
      aria-label="调整侧栏宽度"
      tabIndex={0}
      data-slot="resizable-handle"
      data-separator="inactive"
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onDoubleClick={onReset}
      onKeyDown={handleKeyDown}
      /* 类名与 components/ui/resizable.tsx 的 Separator 逐字一致(省略库托管的水平变体),
         仅补 shrink-0——shadcn 形态下由库注入 */
      className="bg-border focus-visible:ring-1 focus-visible:ring-ring relative flex w-px shrink-0 items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-hidden"
      style={{ touchAction: 'none' }}
    >
      <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
    </div>
  )
}
