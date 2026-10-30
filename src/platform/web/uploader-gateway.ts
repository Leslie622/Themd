import type { UploaderConfig, UploaderGateway, UploadedImage } from '../contracts'

/**
 * 三家服务商的上传协议逻辑(纯函数,注入 fetch 便于测试与复用):
 * - Tauri 端注入 tauri-plugin-http 的 fetch(Rust 层发请求,无 CORS 限制)
 * - Web 端注入原生 fetch(依赖服务商允许跨域)
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** 1px 透明 PNG,测试上传用 */
export const TEST_PNG = Uint8Array.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='.match(/../g) ?? [],
  (h) => parseInt(h, 16),
)

/** 二进制 → base64。FileReader 走原生编码,不受函数参数栈深限制(大图安全) */
function bytesToBase64(bytes: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(new Blob([bytes as BlobPart]))
  })
}

/**
 * SM.MS 已 308 永久迁移到 s.ee(2026 实测:/api/v2/upload → s.ee/api/v1/file/upload),
 * 直接对接 s.ee v1:multipart 上传,file 字段(别名 smfile),Authorization 头放 token。
 * 成功 code===0,data.url 直链 / data.delete 删除链;业务失败也走 HTTP 200/401。
 */
async function uploadSmms(fetchLike: FetchLike, config: UploaderConfig, bytes: Uint8Array, filename: string): Promise<UploadedImage> {
  if (!config.smmsToken.trim()) throw new Error('请先在设置里填写 SM.MS / s.ee 的 API Token')
  const form = new FormData()
  form.append('file', new Blob([bytes as BlobPart]), filename)
  const res = await fetchLike('https://s.ee/api/v1/file/upload', {
    method: 'POST',
    headers: { Authorization: config.smmsToken.trim() },
    body: form,
  })
  const json = await res.json().catch(() => null) as { code?: number; message?: string; data?: { url?: string; delete?: string } } | null
  if (!json || json.code !== 0 || !json.data?.url) {
    throw new Error(json?.message ?? `s.ee 上传失败(HTTP ${res.status})`)
  }
  return { url: json.data.url, deleteUrl: json.data.delete }
}

async function uploadGithub(fetchLike: FetchLike, config: UploaderConfig, bytes: Uint8Array, filename: string): Promise<UploadedImage> {
  const repo = config.githubRepo.trim()
  const token = config.githubToken.trim()
  if (!repo || !repo.includes('/')) throw new Error('请先在设置里填写 GitHub 仓库(owner/repo)')
  if (!token) throw new Error('请先在设置里填写 GitHub token')
  const path = `assets/${filename}`
  const res = await fetchLike(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      // GitHub API 要求 UA,WebView2 默认不发
      'User-Agent': 'themd',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: `upload image ${filename}`,
      content: await bytesToBase64(bytes),
    }),
  })
  const json = await res.json().catch(() => null) as { message?: string; content?: { download_url?: string } } | null
  if (!res.ok || !json?.content?.download_url) {
    throw new Error(json?.message ?? `GitHub 上传失败(HTTP ${res.status})`)
  }
  return { url: json.content.download_url }
}

async function uploadPicgo(fetchLike: FetchLike, config: UploaderConfig, bytes: Uint8Array, filename: string): Promise<UploadedImage> {
  if (!config.picgoUrl.trim()) throw new Error('请先在设置里填写 PicGo 上传接口地址')
  const res = await fetchLike(config.picgoUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list: [{ base64: await bytesToBase64(bytes), fileName: filename }] }),
  })
  const json = await res.json().catch(() => null) as { success?: boolean; result?: string[]; message?: string } | null
  if (!json?.success || !json.result?.[0]) {
    throw new Error(json?.message ?? `PicGo 上传失败(HTTP ${res.status}),请确认 PicGo 正在运行`)
  }
  return { url: json.result[0] }
}

export function uploadWith(fetchLike: FetchLike, config: UploaderConfig, bytes: Uint8Array, filename: string): Promise<UploadedImage> {
  switch (config.provider) {
    case 'smms': return uploadSmms(fetchLike, config, bytes, filename)
    case 'github': return uploadGithub(fetchLike, config, bytes, filename)
    case 'picgo': return uploadPicgo(fetchLike, config, bytes, filename)
  }
}

export function createWebUploaderGateway(): UploaderGateway {
  return {
    upload: (config, bytes, filename) => uploadWith(fetch, config, bytes, filename),
    test: (config) => uploadWith(fetch, config, TEST_PNG, 'themd-test.png').then((r) => r.url),
  }
}
