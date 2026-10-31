import { useEditorPrefs } from '@/store-editor'

/**
 * markdown 里的相对路径图片 → 可实际加载的 src(同步版,渲染管线用)。
 *
 * 绑定磁盘文件的笔记(sourcePath,Typora 语义):相对路径一律相对
 * 笔记自身所在目录解析——`assets/x.png`、`./img.png`、`sub/pic.jpg` 都
 * 从笔记目录找。活动笔记切换时由 App 调 setActiveNoteDir 注入基准目录,
 * 渲染期零异步。
 *
 * 库内笔记(Web 端全部如此):维持旧行为,仅 `assets/` 开头的相对路径
 * 解析到全局图片根目录(本地图片模式落盘位置)。正文统一写
 * `assets/<名>`,应用内渲染时 WebView 拿到相对路径只会相对当前页面解析,
 * 必须在这里改写成真实地址:
 * - 桌面端:Tauri 的 convertFileSrc 把绝对文件路径转 asset:// 协议;
 *   convertFileSrc 本身是纯字符串变换,启动时预取一次函数引用即可同步调用
 * - Web 端:无本地文件,原样返回(显示裂图,属预期)
 *
 * data URL 与 http(s) 外链原样放行。
 */
let defaultRoot: string | null = null
let convertFileSrcFn: ((path: string) => string) | null = null

/** 活动绑定笔记的所在目录;未绑定/库内笔记为 null */
let activeNoteDir: string | null = null

/** 应用启动时注入平台默认根目录与路径转换函数,渲染期零异步 */
export async function initImageSrcResolver(): Promise<void> {
  const [{ convertFileSrc }, { appDataDir, join }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/path'),
  ])
  convertFileSrcFn = convertFileSrc
  defaultRoot = await join(await appDataDir(), 'assets')
}

/** 活动笔记变化时注入其所在目录;未绑定传 undefined 归位库内模式 */
export function setActiveNoteDir(sourcePath: string | undefined): void {
  if (!sourcePath) {
    activeNoteDir = null
    return
  }
  const parts = sourcePath.split(/[\\/]/)
  parts.pop()
  activeNoteDir = parts.join('\\') || null
}

function currentRoot(): string | null {
  const custom = useEditorPrefs.getState().assetsRoot.trim()
  return custom || defaultRoot
}

/**
 * markdown-it 对图片/链接目的地做过 encodeURI 规范化,中文文件名到 renderer
 * 手里已是 `assets/%E5%B1%8F…`。拼文件系统路径前必须解码回真实文件名,
 * 否则磁盘上永远找不到 `%E5…png`;纯 ASCII 路径解码后原样,不受影响。
 * 解码失败(残缺 % 序列)保留原串。
 */
function decodeSrc(src: string): string {
  try {
    return decodeURI(src)
  } catch {
    return src
  }
}

/** 是否指向本地文件的相对路径(排除 scheme、根路径、锚点) */
function isRelativeFilePath(src: string): boolean {
  if (!src || src.startsWith('#')) return false
  if (src.startsWith('/') || src.startsWith('\\')) return false
  // `data:`、`http(s):`、`file:` 等带 scheme 的一律不是相对路径
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(src)) return false
  return /\.[\w]+$/.test(src)
}

/** 笔记目录 + 相对路径 → 文件系统绝对路径(处理 ./ ../ 与双分隔符) */
function joinNotePath(dir: string, rel: string): string {
  const sep = dir.includes('\\') || /^[A-Za-z]:/.test(dir) ? '\\' : '/'
  const stack = dir.split(/[\\/]/).filter(Boolean)
  for (const seg of rel.split(/[\\/]/)) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      stack.pop()
      continue
    }
    stack.push(seg)
  }
  const prefix = dir.startsWith('/') || dir.startsWith('\\') ? sep : ''
  return prefix + stack.join(sep)
}

export function resolveImageSrcSync(src: string): string {
  const trimmed = decodeSrc(src.trim())
  if (!convertFileSrcFn) return src
  // 绑定笔记:相对路径(含 assets/)一律相对笔记自身目录
  if (activeNoteDir) {
    return isRelativeFilePath(trimmed) ? convertFileSrcFn(joinNotePath(activeNoteDir, trimmed)) : src
  }
  // 库内笔记:仅 assets/ 走全局图片根(现状行为)
  if (/^assets\/[^\s]+\.[\w]+$/i.test(trimmed)) {
    const root = currentRoot()
    if (!root) return src
    const absolute = `${root.replace(/[\\/]+$/, '')}/${trimmed.slice('assets/'.length)}`
    return convertFileSrcFn(absolute)
  }
  return src
}

/**
 * 相对路径图片 → 实际文件系统绝对路径(打开文件/定位目录用)。
 * 绑定笔记相对笔记目录;库内笔记仅认 assets/ 相对全局根。
 * 解析不了返回 null。
 */
export function assetsPathToAbsolute(src: string): string | null {
  const trimmed = decodeSrc(src.trim())
  if (activeNoteDir && isRelativeFilePath(trimmed)) return joinNotePath(activeNoteDir, trimmed)
  if (!/^assets\/[^\s]+\.[\w]+$/i.test(trimmed)) return null
  const root = currentRoot()
  if (!root) return null
  return `${root.replace(/[\\/]+$/, '')}/${trimmed.slice('assets/'.length)}`
}
