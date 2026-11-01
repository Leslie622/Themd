/**
 * mermaid 图表渲染(infrastructure 层):按代码哈希缓存 SVG。
 * mermaid 库 ~1MB+,一律动态 import,首图渲染时才加载。
 * live 侧(codeblock-cm 的 mermaid 分支)与预览侧(PreviewPane effect)
 * 共用本模块——同一份代码同一个缓存,三面一致纪律(导出侧 P5 接入)。
 */

let mermaidMod: typeof import('mermaid')['default'] | null = null
let initDone = false

/** 已渲染 SVG 缓存(哈希 → svg);FIFO 上限 64,图表重复滚动不重渲 */
const cache = new Map<string, string>()
const CACHE_LIMIT = 64

function hashCode(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0
  return String(h)
}

async function ensureMermaid(isDark: boolean): Promise<NonNullable<typeof mermaidMod>> {
  if (!mermaidMod) {
    const mod = await import('mermaid')
    mermaidMod = mod.default
  }
  if (!initDone) {
    // errorMessages 汉化不必,主题随应用明暗;安全:严格模式关掉(内容来自自己笔记)
    mermaidMod.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', securityLevel: 'strict' })
    initDone = true
  } else {
    // 主题切换后需重置(mermaid 全局单例)
    await mermaidMod.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', securityLevel: 'strict' })
  }
  return mermaidMod
}

/**
 * 渲染 mermaid 源码为 SVG(缓存命中零成本);失败抛错由调用方决定错误态。
 * @param isDark 应用明暗(主题);变化会重初始化并使缓存失效由调用方处理
 */
export async function renderMermaidSvg(code: string, isDark: boolean): Promise<string> {
  const key = `${isDark ? 'd' : 'l'}:${hashCode(code)}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const mermaid = await ensureMermaid(isDark)
  const { svg } = await mermaid.render(`mmd-${Math.random().toString(36).slice(2, 10)}`, code)
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, svg)
  return svg
}
