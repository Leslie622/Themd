import Lightbox, {
  useController,
  useLightboxState,
  useNavigationState,
  type ZoomRef,
} from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import './image-lightbox.css'

import { Button } from '@/components/ui/button'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  RotateCwSquareIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useState } from 'react'

export interface LightboxSlide {
  /** 已解析好的可加载地址(asset:///data/https) */
  src: string
  alt?: string
}

/**
 * 从预览容器收集全部图片作为 slides,并定位被点击的那张。
 * 预览区事件委托专用:点中的不是 <img> 时返回 null(不拦默认行为)。
 */
export function collectLightboxState(
  container: Element,
  target: EventTarget | null,
): { slides: LightboxSlide[]; index: number } | null {
  const img = (target as HTMLElement | null)?.closest('img')
  if (!img) return null
  const imgs = Array.from(container.querySelectorAll<HTMLImageElement>('.themd-prose img'))
  return {
    slides: imgs.map((el) => ({ src: el.currentSrc || el.src, alt: el.alt })),
    index: Math.max(0, imgs.indexOf(img)),
  }
}

/**
 * 图片灯箱：预览区点击图片后的全屏放大查看。
 * 基于 yet-another-react-lightbox：一次传入所在预览的全部图片，
 * 可在多张之间左右切换（箭头/方向键）；Zoom 插件提供滚轮缩放/双击/pinch，
 * Captions 插件展示 alt 说明，Esc / 点击空白由库内置。
 * 旋转(按图记忆,90° 递增)与下载(fetch→blob)为自定义工具栏按钮。
 * 所有按钮（关闭/缩放/旋转/下载/前后切换）经 render 定制口换成 shadcn Button；
 * 按钮带常显深色磨砂圆底，白色图标压在白色图片上也看得见。
 */

/** shadcn ghost 按钮的灯箱外衣：深色磨砂圆底，禁用态降透明但不消失 */
const buttonScrim =
  'rounded-full bg-black/30 text-white/90 shadow-none backdrop-blur-sm ' +
  'hover:bg-black/55 hover:text-white ' +
  'disabled:pointer-events-none disabled:bg-black/15 disabled:text-white/35 disabled:opacity-100'

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="关闭"
      title="关闭"
      className={cn(buttonScrim)}
      onClick={onClose}
    >
      <XIcon />
    </Button>
  )
}

function ZoomButtons({ zoomRef }: { zoomRef: ZoomRef }) {
  const unavailable = zoomRef.disabled
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="缩小"
        title="缩小"
        className={cn(buttonScrim)}
        disabled={unavailable || zoomRef.zoom <= zoomRef.minZoom + 0.001}
        onClick={zoomRef.zoomOut}
      >
        <ZoomOutIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="放大"
        title="放大"
        className={cn(buttonScrim)}
        disabled={unavailable || zoomRef.zoom >= zoomRef.maxZoom - 0.001}
        onClick={zoomRef.zoomIn}
      >
        <ZoomInIcon />
      </Button>
    </div>
  )
}

function RotateButton({ onRotate }: { onRotate: (index: number) => void }) {
  const { currentIndex } = useLightboxState()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="旋转"
      title="旋转 90°"
      className={cn(buttonScrim)}
      onClick={() => currentIndex !== undefined && onRotate(currentIndex)}
    >
      <RotateCwSquareIcon />
    </Button>
  )
}

function DownloadButton() {
  const { slides, currentIndex } = useLightboxState()
  const slide = currentIndex !== undefined ? slides[currentIndex] : undefined

  const onDownload = async () => {
    if (!slide) return
    const name = fileNameFor(slide.src, slide.alt)
    try {
      // 先取字节再以 blob 触发下载:同源限制下 <a download> 对跨域地址不生效
      const res = await fetch(slide.src)
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      triggerDownload(url, name)
      URL.revokeObjectURL(url)
    } catch {
      // 图床 CORS 等拿不到字节的场景,回落浏览器默认行为(打开/原生下载)
      triggerDownload(slide.src, name)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="下载"
      title="下载"
      className={cn(buttonScrim)}
      onClick={onDownload}
    >
      <DownloadIcon />
    </Button>
  )
}

function triggerDownload(href: string, name: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** 从 src/alt 推导下载文件名(清洗非法字符) */
function fileNameFor(src: string, alt?: string): string {
  const clean = (s: string) => s.trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'image'
  if (src.startsWith('data:')) {
    const mime = /^data:([^;,]+)/.exec(src)?.[1] ?? 'image/png'
    const ext = mime.split('/')[1]?.replace('jpeg', 'jpg').split('+')[0] || 'png'
    return `${clean(alt ?? 'image')}.${ext}`
  }
  try {
    const name = decodeURIComponent(new URL(src).pathname.split('/').pop() ?? '')
    if (name) return name
  } catch {
    // 非 URL 形态,走 alt 兜底
  }
  return clean(alt ?? 'image')
}

function NavButton({ side }: { side: 'prev' | 'next' }) {
  const { prev, next } = useController()
  const { prevDisabled, nextDisabled } = useNavigationState()
  // 垂直居中用 wrapper 而非 -translate-y-1/2:shadcn Button 的按压反馈
  // active:translate-y-px 会覆盖 translate 变量,导致按钮按压时下坠半个屏高
  const isPrev = side === 'prev'
  return (
    <div className={cn('absolute inset-y-0 flex items-center', isPrev ? 'left-4' : 'right-4')}>
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={isPrev ? '上一张' : '下一张'}
        title={isPrev ? '上一张' : '下一张'}
        className={cn('size-10', buttonScrim)}
        disabled={isPrev ? prevDisabled : nextDisabled}
        onClick={() => (isPrev ? prev() : next())}
      >
        {isPrev ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </Button>
    </div>
  )
}

export function ImageLightbox({
  slides,
  initialIndex,
  onClose,
}: {
  /** 空数组 = 关闭 */
  slides: LightboxSlide[]
  /** 打开时定位到第几张 */
  initialIndex?: number
  onClose: () => void
}) {
  // 每张图的旋转角(度),按 slide 序号记忆;换一组 slides(重开/换笔记)时复位
  const [rotations, setRotations] = useState<Record<number, number>>({})
  useEffect(() => {
    setRotations({})
  }, [slides])

  // 把旋转角写到对应序号的 slide 图像上。
  // YARL 的缩放/平移 transform 在 slide wrapper 上,与图像自身的 rotate 不冲突;
  // carousel 按 slides 顺序渲染 .yarl__slide_image,DOM 序号即 slide 序号
  useEffect(() => {
    document.querySelectorAll<HTMLImageElement>('.yarl__slide_image').forEach((im, i) => {
      im.style.transform = rotations[i] ? `rotate(${rotations[i]}deg)` : ''
    })
  }, [rotations, slides])

  const handleRotate = useCallback((index: number) => {
    setRotations((prev) => ({ ...prev, [index]: ((prev[index] ?? 0) + 90) % 360 }))
  }, [])

  return (
    <Lightbox
      open={slides.length > 0}
      close={onClose}
      index={initialIndex}
      slides={slides.map((s) => ({ src: s.src, alt: s.alt, description: s.alt }))}
      plugins={[Zoom, Captions]}
      // padding: 四周留白,初始 fit 尺寸不要铺满整个视口
      carousel={{ finite: true, padding: '64px' }}
      // 点空白(slide 区域)关闭——库默认不关
      controller={{ closeOnBackdropClick: true }}
      // maxZoomPixelRatio: 放大上限(相对图片像素尺寸的倍数)。
      // 不能传 -1——会把尺寸乘成负数,导致缩放按钮永远 disabled。
      // scrollToZoom: 纯滚轮直接缩放(默认关闭,纯滚轮被用于平移)。
      // minZoom: 默认 1 = 初始即最小、无法缩小;放开到 0.5 才能滚轮缩小。
      // wheelZoomDistanceFactor: 默认 100 时一格滚轮直接 ×2,调大到 800 让每格约 ±15%
      zoom={{ minZoom: 0.5, maxZoomPixelRatio: 4, zoomInMultiplier: 1.4, scrollToZoom: true, wheelZoomDistanceFactor: 800 }}
      animation={{ fade: 130, swipe: 220 }}
      render={{
        // 按钮全部换成 shadcn Button;'zoom' 占位键见 toolbar.buttons
        buttonZoom: (zoomRef) => <ZoomButtons zoomRef={zoomRef} />,
        buttonPrev: () => <NavButton side="prev" />,
        buttonNext: () => <NavButton side="next" />,
      }}
      // 'zoom' 是 YARL 的占位键,Zoom 插件会把缩放按钮替换到这个位置
      toolbar={{
        buttons: [
          'zoom',
          <RotateButton key="rotate" onRotate={handleRotate} />,
          <DownloadButton key="download" />,
          <CloseButton key="close" onClose={onClose} />,
        ],
      }}
    />
  )
}
