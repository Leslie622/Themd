import { useEffect, useMemo } from 'react'

import { extraCssToStyle } from '@/lib/theme/compile'

/**
 * 把主题的附加 CSS（extraCss）注入为作用域限定的 <style>。
 * 全部生命周期在 effect 内：创建/更新/移除都在文档头上完成，
 * StrictMode 的 挂载→清理→再挂载 天然安全。themeId 作 data 属性便于调试识别。
 */
export function useExtraCss(themeId: string, extraCss: string | undefined) {
  const styleText = useMemo(
    () => (extraCss?.trim() ? extraCssToStyle(themeId, extraCss) : ''),
    [themeId, extraCss],
  )

  useEffect(() => {
    if (!styleText) return
    const el = document.createElement('style')
    el.dataset.themdExtra = themeId
    el.textContent = styleText
    document.head.appendChild(el)
    return () => {
      el.remove()
    }
  }, [themeId, styleText])
}
