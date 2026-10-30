import { platformServices } from '@/app/platform'
import { useEditorPrefs } from '@/store-editor'

/**
 * markdown 里的 assets/ 相对路径 → 可实际加载的 src(同步版,渲染管线用)。
 *
 * 本地图片模式把图片落在 `${root}/assets/<名>`,正文统一写
 * `assets/<名>`(导出 .md 干净、发给别人连文件夹即看)。
 * 但应用内渲染时浏览器/WebView 拿到相对路径只会相对当前页面
 * (http://localhost:1420/ 或 tauri://localhost/) 解析,指向不存在的
 * web 资源——必须在这里改写成真实地址:
 * - 桌面端:Tauri 的 convertFileSrc 把绝对文件路径转 asset:// 协议;
 *   convertFileSrc 本身是纯字符串变换,启动时预取一次函数引用即可同步调用
 * - Web 端:无本地文件,原样返回(显示裂图,属预期)
 *
 * data URL 与 http(s) 外链原样放行;仅处理 assets/ 开头的相对路径。
 */
let defaultRoot: string | null = null
let convertFileSrcFn: ((path: string) => string) | null = null

/** 应用启动时注入平台默认根目录与路径转换函数(桌面端),渲染期零异步 */
export async function initImageSrcResolver(): Promise<void> {
  if (!platformServices.isDesktop) return
  const [{ convertFileSrc }, { appDataDir, join }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/path'),
  ])
  convertFileSrcFn = convertFileSrc
  defaultRoot = await join(await appDataDir(), 'assets')
}

function currentRoot(): string | null {
  const custom = useEditorPrefs.getState().assetsRoot.trim()
  return custom || defaultRoot
}

export function resolveImageSrcSync(src: string): string {
  const trimmed = src.trim()
  if (!/^assets\/[^\s]+\.[\w]+$/i.test(trimmed)) return src
  const root = currentRoot()
  if (!root || !convertFileSrcFn) return src
  const absolute = `${root.replace(/[\\/]+$/, '')}/${trimmed.slice('assets/'.length)}`
  return convertFileSrcFn(absolute)
}

/**
 * assets/ 相对路径 → 实际文件系统绝对路径(打开文件/定位目录用)。
 * 解析不了(无根目录/非 assets 路径)返回 null。
 */
export function assetsPathToAbsolute(src: string): string | null {
  const trimmed = src.trim()
  if (!/^assets\/[^\s]+\.[\w]+$/i.test(trimmed)) return null
  const root = currentRoot()
  if (!root) return null
  return `${root.replace(/[\\/]+$/, '')}/${trimmed.slice('assets/'.length)}`
}
