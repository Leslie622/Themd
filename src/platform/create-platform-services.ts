import { isTauri } from '@/lib/theme/font-list'
import type { AutostartGateway, FileGateway, FontGateway, PdfGateway, WindowGateway } from './contracts'
import { createWebFileGateway } from './web/file-gateway'
import { createTauriFileGateway } from './tauri/file-gateway'

export interface PlatformServices { isDesktop: boolean; files: FileGateway; pdf: PdfGateway; fonts: FontGateway; window: WindowGateway; autostart: AutostartGateway }

export function createPlatformServices(): PlatformServices {
  if (isTauri()) return { isDesktop: true, files: createTauriFileGateway(), pdf: createTauriPdfGateway(), fonts: createTauriFontGateway(), window: createTauriWindowGateway(), autostart: createTauriAutostartGateway() }
  return { isDesktop: false, files: createWebFileGateway(), pdf: { print: async () => window.print(), exportToPath: async () => window.print(), onAfterPrint: (listener) => { window.addEventListener('afterprint', listener); return () => window.removeEventListener('afterprint', listener) } }, fonts: { listFamilies: async () => [] }, window: { minimize: async () => {}, toggleMaximize: async () => {}, close: async () => {}, isMaximized: async () => false, onMaximizedChange: async () => () => {} }, autostart: { isEnabled: async () => false, setEnabled: async () => {} } }
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
