import type { AutostartGateway, FileGateway, FileLinkGateway, FontGateway, PdfGateway, UploaderGateway, WindowGateway } from './contracts'
import { createTauriFileGateway } from './tauri/file-gateway'
import { createTauriFileLinkGateway } from './tauri/file-link-gateway'
import { createTauriUploaderGateway } from './tauri/uploader-gateway'

/** 平台服务集合。本应用仅支持 Tauri 桌面端(Web 路线已清除) */
export interface PlatformServices { files: FileGateway; fileLink: FileLinkGateway; pdf: PdfGateway; fonts: FontGateway; window: WindowGateway; autostart: AutostartGateway; uploader: UploaderGateway }

export function createPlatformServices(): PlatformServices {
  return { files: createTauriFileGateway(), fileLink: createTauriFileLinkGateway(), pdf: createTauriPdfGateway(), fonts: createTauriFontGateway(), window: createTauriWindowGateway(), autostart: createTauriAutostartGateway(), uploader: createTauriUploaderGateway() }
}

function createTauriPdfGateway(): PdfGateway { return { print: async () => window.print(), exportToPath: async (path) => { const { invoke } = await import('@tauri-apps/api/core'); await invoke('export_pdf', { path }) }, onAfterPrint: (listener) => { window.addEventListener('afterprint', listener); return () => window.removeEventListener('afterprint', listener) } } }
function createTauriFontGateway(): FontGateway { return { listFamilies: async () => { const { invoke } = await import('./tauri/commands'); return invoke<string[]>('list_system_fonts') } } }
function createTauriWindowGateway(): WindowGateway {
  return {
    minimize: async () => { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().minimize() },
    toggleMaximize: async () => { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().toggleMaximize() },
    close: async () => { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().close() },
    isMaximized: async () => { const { getCurrentWindow } = await import('@tauri-apps/api/window'); return getCurrentWindow().isMaximized() },
    onMaximizedChange: async (listener) => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      return getCurrentWindow().onResized(async () => listener(await getCurrentWindow().isMaximized()))
    },
  }
}
function createTauriAutostartGateway(): AutostartGateway {
  return {
    isEnabled: async () => { const { isEnabled } = await import('@tauri-apps/plugin-autostart'); return isEnabled() },
    setEnabled: async (enabled) => {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart')
      if (enabled) await enable()
      else await disable()
    },
  }
}
