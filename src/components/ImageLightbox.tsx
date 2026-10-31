import Lightbox, { useController, useNavigationState, type ZoomRef } from 'yet-another-react-lightbox'
import Captions from 'yet-another-react-lightbox/plugins/captions'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import './image-lightbox.css'

import { Button } from '@/components/ui/button'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
 * 所有按钮（关闭/缩放/前后切换）经 render 定制口换成 shadcn Button；
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
        // 三个按钮组全部换成 shadcn Button
        buttonZoom: (zoomRef) => <ZoomButtons zoomRef={zoomRef} />,
        buttonPrev: () => <NavButton side="prev" />,
        buttonNext: () => <NavButton side="next" />,
      }}
      toolbar={{ buttons: [<CloseButton key="close" onClose={onClose} />] }}
    />
  )
}
