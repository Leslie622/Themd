import type { TrayMenuGateway } from '../contracts'
import { invoke } from './commands'

const TRAY_OPEN_EVENT = 'tray://open'

interface TrayAnchorPayload {
  cursor_x: number
  cursor_y: number
}

export function createTauriTrayMenuGateway(): TrayMenuGateway {
  return {
    async onOpenRequest(listener) {
      const { listen } = await import('@tauri-apps/api/event')
      return listen<TrayAnchorPayload>(TRAY_OPEN_EVENT, (event) =>
        listener({ cursorX: event.payload.cursor_x, cursorY: event.payload.cursor_y }),
      )
    },
    async onBlur(listener) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      return getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused) listener()
      })
    },
    async commitGeometry(cursorX, cursorY, width, height) {
      await invoke('position_tray_menu', { cursorX, cursorY, width, height })
    },
    async resizeTrayMenu(cursorX, cursorY, widthPx, heightPx) {
      await invoke('resize_tray_menu', { cursorX, cursorY, widthPx, heightPx })
    },
    async close() {
      await invoke('close_tray_menu')
    },
    async showMainWindow() {
      await invoke('tray_menu_action', { action: 'show' })
    },
    async quitApp() {
      await invoke('tray_menu_action', { action: 'quit' })
    },
  }
}
