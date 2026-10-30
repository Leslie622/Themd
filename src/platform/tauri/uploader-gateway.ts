import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import type { UploaderGateway } from '../contracts'
import { TEST_PNG, uploadWith } from '../web/uploader-gateway'

/**
 * Tauri 图床网关:协议逻辑复用 Web 纯函数,仅把 fetch 换成
 * tauri-plugin-http——请求由 Rust 层发出,不受 WebView CORS 限制,
 * 任意服务商/自建 PicGo 端口都能直连。
 */
export function createTauriUploaderGateway(): UploaderGateway {
  return {
    upload: (config, bytes, filename) => uploadWith(tauriFetch, config, bytes, filename),
    test: (config) => uploadWith(tauriFetch, config, TEST_PNG, 'themd-test.png').then((r) => r.url),
  }
}
