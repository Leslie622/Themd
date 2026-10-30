import type { EditorView } from '@uiw/react-codemirror'

/**
 * 图片插入:File → 压缩 base64 data URL → 内嵌进 markdown 正文。
 * 无服务器前提下的最优解:笔记自包含、多端可显示、导出 .md 自带图片。
 * 存储层走 IndexedDB,容量不再是瓶颈;
 * 压缩控制单图体积,同时避免超长 base64 行拖慢 CodeMirror。
 */

/** 压缩参数:长边上限与 WebP 质量,截图类图片通常落在 100~300KB */
const MAX_EDGE = 1600
const WEBP_QUALITY = 0.82
/** 原始文件大小上限,防解码炸弹 */
const MAX_INPUT_BYTES = 20 * 1024 * 1024

const isGif = (file: File) => file.type === 'image/gif'
const isSvg = (file: File) => file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** GIF/SVG 原样字节:动画与矢量不能过 canvas 重编码 */
async function rawBlob(file: File): Promise<Blob> {
  if (file.size > MAX_INPUT_BYTES) throw new Error('图片超过 20MB')
  return file
}

const fallbackExt = (file: File) => (/\.(\w+)$/.exec(file.name)?.[1] ?? 'png').toLowerCase()

/**
 * 内嵌模式的压缩管线:位图解码 → 等比缩放(长边 1600)→ WebP(0.82)。
 * 内嵌把图片塞进正文,体积即笔记本体,必须压缩;GIF/SVG 原样(动画/矢量
 * 不能重编码)。本地 assets 模式不走这里——原文件字节直接落盘,保真优先。
 */
async function compressToBlob(file: File): Promise<{ blob: Blob; ext: string }> {
  if (isGif(file) || isSvg(file)) return { blob: await rawBlob(file), ext: isSvg(file) ? 'svg' : 'gif' }
  if (file.size > MAX_INPUT_BYTES) throw new Error('图片超过 20MB')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', WEBP_QUALITY),
    )
    // toBlob 失败(极老内核)回落原文件
    return { blob: blob ?? file, ext: blob ? 'webp' : fallbackExt(file) }
  } finally {
    bitmap.close()
  }
}

/** 处理单个图片文件为内嵌 data URL(内嵌模式);用户可感知的错误抛出,由调用方 toast */
export async function fileToEmbeddedImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`「${file.name}」不是图片`)
  }
  const { blob } = await compressToBlob(file)
  return blobToDataUrl(blob)
}

/**
 * 处理单个图片文件为本地 assets 落盘(本地文件夹模式)。
 * **原样字节落盘,不重编码**:本地模式的核心价值是保真(与 Typora/Obsidian
 * 一致),PNG 就是 PNG;体积优化只属于内嵌模式。root 语义 = 图片最终存放
 * 目录;文件名带短随机后缀防同名覆盖。
 */
export async function fileToAssetImage(
  file: File,
  root: string,
  write: (path: string, bytes: Uint8Array) => Promise<void>,
): Promise<{ relativePath: string; absolutePath: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`「${file.name}」不是图片`)
  }
  if (file.size > MAX_INPUT_BYTES) throw new Error('图片超过 20MB')
  const ext = fallbackExt(file)
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_') || 'image'
  const name = `${base}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const normalizedRoot = root.replace(/[\\/]+$/, '')
  const absolutePath = `${normalizedRoot}/${name}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  await write(absolutePath, bytes)
  return { relativePath: `assets/${name}`, absolutePath }
}

/**
 * 在 CodeMirror 光标/落点处插入独立一行的图片标记。
 * 前后补空行保证 markdown 解析,插入后光标落在行尾方便继续输入。
 */
export function insertImageMarkdown(
  view: EditorView,
  pos: number,
  dataUrl: string,
  alt = '图片',
): void {
  const doc = view.state.doc
  const at = Math.min(Math.max(0, pos), doc.length)
  const line = doc.lineAt(at)
  // 行首插入:图片独占一行,原内容自然落在空行之后;
  // 行中/行尾插入:先断段再插,避免图片拼进原段落
  const prefix = at === line.from ? '' : '\n\n'
  const insert = `${prefix}![${alt}](${dataUrl})\n\n`
  view.dispatch({
    changes: { from: at, insert },
    selection: { anchor: at + insert.length },
    scrollIntoView: true,
  })
  view.focus()
}
