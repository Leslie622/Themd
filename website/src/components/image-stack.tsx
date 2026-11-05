import { useCallback, useEffect, useRef, useState } from "react"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLang } from "@/lib/i18n/i18n-context"

interface ImageStackProps {
  images: { src: string; alt: string }[]
  /** 自动轮换间隔毫秒数 */
  intervalMs?: number
  /** 点击卡片时回调（打开灯箱） */
  onOpen?: (image: { src: string; alt: string }) => void
}

/** 按堆叠深度（0 = 最顶层）给出位移/旋转/缩放 */
const depthClasses = [
  "z-40 rotate-0 translate-x-0 translate-y-0 scale-95",
  "z-30 rotate-4 translate-x-10 translate-y-3 scale-[0.91]",
  "z-20 -rotate-4 -translate-x-10 translate-y-3 scale-[0.87]",
  "z-10 rotate-9 translate-x-16 translate-y-7 scale-[0.82]",
  "z-5 -rotate-9 -translate-x-20 translate-y-8 scale-[0.77]",
]

const CARD_TRANSITION_MS = 700

/**
 * 层叠图片组：卡片扇形堆叠，顶卡平滑滑入队尾循环（无淡出，全程连续位移）。
 * 左右箭头手动切换；hover 暂停自动轮换。
 */
export function ImageStack({ images, intervalMs = 3500, onOpen }: ImageStackProps) {
  const { t } = useLang()
  const [order, setOrder] = useState(() => images.map((_, i) => i))
  const pausedRef = useRef(false)

  /** dir=1 顶卡滑到队尾；dir=-1 队尾卡滑到顶。中断进行中的过渡时 CSS 会平滑重定向 */
  const step = useCallback((dir: 1 | -1) => {
    setOrder((o) =>
      o.length < 2 ? o : dir === 1 ? [...o.slice(1), o[0]] : [o[o.length - 1], ...o.slice(0, -1)]
    )
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!pausedRef.current) step(1)
    }, intervalMs)
    return () => {
      window.clearInterval(id)
    }
  }, [step, intervalMs])

  return (
    <div
      className="group relative aspect-128/69 w-full select-none"
      onMouseEnter={() => {
        pausedRef.current = true
      }}
      onMouseLeave={() => {
        pausedRef.current = false
      }}
    >
      {order.map((imgIdx, depth) => {
        const img = images[imgIdx]
        if (!img) return null
        return (
          <div
            key={imgIdx}
            onClick={() => onOpen?.(img)}
            className={cn(
              "group/card absolute inset-0 cursor-zoom-in overflow-hidden rounded-2xl border bg-card shadow-2xl transition-all ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              depthClasses[depth] ?? depthClasses[depthClasses.length - 1]
            )}
            style={{ transitionDuration: `${CARD_TRANSITION_MS}ms` }}
          >
            <img
              src={img.src}
              alt={img.alt}
              className="size-full object-cover"
              loading={depth === 0 ? "eager" : "lazy"}
            />
          </div>
        )
      })}

      {/* 左右切换箭头 */}
      <button
        type="button"
        aria-label={t.hero.prevImage}
        onClick={() => step(-1)}
        className="absolute left-4 top-1/2 z-50 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label={t.hero.nextImage}
        onClick={() => step(1)}
        className="absolute right-4 top-1/2 z-50 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border bg-background/70 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  )
}
