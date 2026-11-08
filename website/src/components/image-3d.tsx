import { cn } from "@/lib/utils"

interface Image3DProps {
  lightSrc: string
  alt: string
  className?: string
  direction?: "left" | "right"
  /** 点击图片时回调（打开灯箱） */
  onOpen?: (src: string, alt: string) => void
}

/**
 * Hover 3D 视差图片卡片（移植自 shadcnstore landing 模板 image-3d.tsx，
 * next/image 换原生 img）。纯 CSS 实现：group-hover 触发旋转/位移/扫光。
 */
export function Image3D({
  lightSrc,
  alt,
  className,
  direction = "left",
  onOpen,
}: Image3DProps) {
  const isRight = direction === "right"

  return (
    <div
      className={cn("group relative aspect-128/69 w-full cursor-zoom-in", className)}
      onClick={() => onOpen?.(lightSrc, alt)}
    >
      <div className="perspective-distant transform-3d">
        {/* Animated background glow */}
        <div className="absolute sm:-inset-8 rounded-3xl bg-gradient-to-r from-primary/10 via-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-all duration-1000 blur-2xl" />

        {/* Main 3D container */}
        <div className="relative size-full transform-3d group-hover:rotate-x-8 group-hover:rotate-y-12 group-hover:translate-z-16 transition-all duration-700 ease-out">
          {/* Depth layers for 3D effect */}
          <div className="absolute inset-0 translate-y-4 translate-x-2 -translate-z-8 rounded-2xl">
            <div className="size-full rounded-2xl bg-gradient-to-br from-primary/10 via-background/40 to-secondary/10 shadow-xl" />
          </div>

          {/* Main image container */}
          <div className="relative z-10 size-full rounded-2xl overflow-hidden shadow-2xl shadow-primary/20">
            {/* Shimmer effect */}
            <div
              className={cn(
                "absolute inset-0 z-20 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transition-transform duration-1000 ease-out pointer-events-none",
                isRight
                  ? "translate-x-full group-hover:-translate-x-full"
                  : "-translate-x-full group-hover:translate-x-full"
              )}
            />

            {/* Main image */}
            <img
              src={lightSrc}
              alt={alt}
              width={2560}
              height={1380}
              className="block size-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />

            {/* Border highlight */}
            <div className="absolute inset-0 rounded-2xl ring-1 ring-white/20 dark:ring-white/10 group-hover:ring-primary/40 transition-all duration-500" />
          </div>
        </div>
      </div>
    </div>
  )
}
