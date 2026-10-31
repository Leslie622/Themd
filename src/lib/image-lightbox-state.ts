/** 灯箱的输入 slides 与收集逻辑,独立于组件导出(react-refresh HMR 粒度要求) */

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
