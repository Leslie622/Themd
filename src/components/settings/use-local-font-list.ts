import { useEffect, useState } from 'react'

import {
  detectInstalledFonts,
  getCachedFullFontList,
  requestAllFonts,
} from '@/lib/theme/font-list'

let fontListPromise: Promise<string[]> | null = null
/** 全局共享的本机字体列表:首个调用方触发,其余复用;idle 后跑,不阻塞抽屉动画 */
function loadLocalFonts(): Promise<string[]> {
  if (!fontListPromise) {
    fontListPromise = new Promise<string[]>((resolve) => {
      const cached = getCachedFullFontList()
      if (cached) return resolve(cached)
      const run = () => resolve(detectInstalledFonts())
      if ('requestIdleCallback' in window) {
        // timeout 兜底:后台标签页 idle 回调可能长期不触发,最多等 2s
        ;(
          window as never as {
            requestIdleCallback(cb: () => void, opts?: { timeout: number }): void
          }
        ).requestIdleCallback(run, { timeout: 2000 })
      } else {
        setTimeout(run, 400)
      }
    })
  }
  return fontListPromise
}

/**
 * 本机字体列表 + 自动获取完整列表。打开字体弹窗即自动请求:
 * 桌面端走 IPC 直出全量;浏览器端 queryLocalFonts 弹授权,拒绝或
 * 不支持时静默回落到 canvas 探测名单,不打扰用户。
 */
export function useLocalFontList() {
  const [fonts, setFonts] = useState<string[]>([])
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    let alive = true
    void loadLocalFonts().then((list) => {
      if (alive) setFonts(list)
    })
    return () => {
      alive = false
    }
  }, [])

  /** 自动/手动触发完整枚举;silent 用于自动路径(失败不弹 toast) */
  const requestFullList = async (silent = false) => {
    setRequesting(true)
    const result = await requestAllFonts()
    setRequesting(false)
    if (result.ok) {
      fontListPromise = Promise.resolve(result.fonts)
      setFonts(result.fonts)
      return
    }
    if (silent) return
    // 仅显式触发时提示失败原因
    if (result.reason === 'denied') {
      // 浏览器拒绝授权:静默即可,探测名单仍然可用
    }
  }

  return { fonts, requesting, requestFullList }
}
