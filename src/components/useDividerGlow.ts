import { useEffect, useRef } from 'react'

/** 水平感应半径(px):只在指针落到分割线(含 4px 热区)上时触发,留几 px 柔边 */
const GLOW_RADIUS = 10
/** 按下触发半径(px):对齐库 resizeTargetMinimumSize 的 fine 默认 10px,
 *  保证「按下去能开始拖拽」的落点都点亮高光(把手元素本身只有 ±2px) */
const PRESS_RADIUS = 10
/** 把手半高(px,shadcn withHandle 的 h-6),与 CSS 核心半长共同决定把手染色区间 */
const KNOB_HALF = 12
/** 高光核心半长(px),须与 index.css .divider-glow::before 核心层 140px 同步 */
const CORE_HALF = 70

/** 按下点是否落在滚动条上:滚动条常紧贴分割线,拖它不算拖分割线。
 *  覆盖两类——原生滚动条(gutter 几何)与自绘浮动滚动条(CM overlay 与
 *  Radix ScrollArea 同构,均为普通 DOM 元素,gutter 检测不到,靠 data-slot 识别) */
function onScrollbar(event: PointerEvent): boolean {
  const target = event.target as HTMLElement | null
  if (target?.closest('[data-slot="scroll-area-scrollbar"]')) return true
  let node = target
  while (node && node !== document.documentElement) {
    const gutterX = node.offsetWidth - node.clientWidth
    const gutterY = node.offsetHeight - node.clientHeight
    if (gutterX > 0 || gutterY > 0) {
      const rect = node.getBoundingClientRect()
      if (gutterX > 0 && event.clientX > rect.right - gutterX) return true
      if (gutterY > 0 && event.clientY > rect.bottom - gutterY) return true
    }
    node = node.parentElement
  }
  return false
}

/**
 * 分割线指针跟随渐变高光。返回的 ref 挂到把手元素上(元素须同时带
 * .divider-glow 类,高光样式见 index.css)。只在把手上按住鼠标(拖拽态)
 * 期间生效:pointermove 直写 CSS 变量不触发 React 渲染,--glow-y 纵向
 * 坐标、--glow-strength 水平距离亮度、--glow-knob 把手染色系数(光带
 * 扫到把手才非零),松手或指针离开窗口时归零。
 */
export function useDividerGlow() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let pressed = false
    const zero = () => {
      el.style.setProperty('--glow-strength', '0')
      el.style.setProperty('--glow-knob', '0')
    }
    const apply = (x: number, y: number) => {
      const rect = el.getBoundingClientRect()
      const dx = Math.abs(x - (rect.left + rect.width / 2))
      const t = Math.max(0, 1 - dx / GLOW_RADIUS)
      const strength = t * (2 - t)
      el.style.setProperty('--glow-y', `${y - rect.top}px`)
      el.style.setProperty('--glow-strength', strength.toFixed(3))
      // 把手只在光带扫过它(线中央)时染色:进入把手半高内满染,
      // 再往外按核心半长线性褪回灰
      const knobDy = Math.abs(y - rect.top - rect.height / 2)
      const knobT = Math.max(0, 1 - Math.max(0, knobDy - KNOB_HALF) / CORE_HALF)
      el.style.setProperty('--glow-knob', (knobT * strength).toFixed(3))
    }
    const onMove = (event: PointerEvent) => {
      if (pressed) apply(event.clientX, event.clientY)
    }
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      // 便宜的几何判断在前:过滤掉绝大多数无关点击,onScrollbar 的父链
      // 遍历(逐层 offsetWidth/clientWidth,强制 reflow)只在贴近把手时才跑
      const rect = el.getBoundingClientRect()
      if (Math.abs(event.clientX - (rect.left + rect.width / 2)) > PRESS_RADIUS) return
      if (onScrollbar(event)) return
      pressed = true
      apply(event.clientX, event.clientY)
    }
    const onUp = () => {
      pressed = false
      zero()
    }
    const onLeave = () => {
      if (!pressed) zero()
    }
    // 捕获阶段监听:库在把手的 pointerdown 里 stopPropagation,冒泡阶段收不到真实按下
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return ref
}
