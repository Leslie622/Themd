import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLang } from "@/lib/i18n/i18n-context"

interface ImageLightboxProps {
  /** 当前展示的图片；null = 关闭 */
  image: { src: string; alt: string } | null
  onClose: () => void
}

/** 官网截图灯箱：全屏展示原图，点击图片在适应窗口与 1:1 原图间切换 */
export function ImageLightbox({ image, onClose }: ImageLightboxProps) {
  const { t } = useLang()
  const [zoomed, setZoomed] = React.useState(false)

  React.useEffect(() => {
    setZoomed(false)
  }, [image?.src])

  React.useEffect(() => {
    if (!image) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [image, onClose])

  if (!image) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "rounded-lg",
          zoomed ? "max-h-full max-w-full overflow-auto" : "max-h-full max-w-full"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={image.src}
          alt={image.alt}
          onClick={() => setZoomed((z) => !z)}
          className={cn(
            "rounded-lg shadow-2xl",
            zoomed
              ? "max-w-none w-[2560px] cursor-zoom-out"
              : "max-h-[88vh] max-w-[94vw] w-auto h-auto object-contain cursor-zoom-in"
          )}
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label={t.common.close}
        className="absolute right-4 top-4 z-10 cursor-pointer bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
      >
        <X className="size-5" />
      </Button>
      <span className="absolute bottom-5 text-xs text-white/70 select-none">
        {t.common.lightboxHint}
      </span>
    </div>,
    document.body
  )
}
