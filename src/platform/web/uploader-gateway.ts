import type { UploaderConfig, UploaderGateway, UploadedImage } from '../contracts'

/**
 * 各服务商的上传协议逻辑(纯函数,注入 fetch 便于测试与复用):
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

async function uploadGithub(fetchLike: FetchLike, config: UploaderConfig, bytes: Uint8Array, filename: string): Promise<UploadedImage> {
  const repo = config.githubRepo.trim()
  const token = config.githubToken.trim()
  if (!repo || !repo.includes('/')) throw new Error('请先在设置的「图床配置」中填写 GitHub 仓库(owner/repo)')
  if (!token) throw new Error('请先在设置的「图床配置」中填写 GitHub token')
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
  if (!config.picgoUrl.trim()) throw new Error('请先在设置的「图床配置」中填写 PicGo 上传接口地址')
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
