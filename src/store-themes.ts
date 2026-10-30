/** Compatibility facade over the theme application controller. */
import { useSyncExternalStore } from 'react'
import { BUILTIN_THEMES } from '@/lib/theme/builtin'
import type { ThemeFile, ThemeState } from '@/lib/theme/schema'
import type { ThemeTokens } from '@/lib/theme/tokens'
import { applicationServices } from '@/app/services'

export { BUILTIN_THEMES }
export type { ThemeFile, ThemeTokens }

const controller = applicationServices.themes
void controller.hydrate().catch((error: unknown) => console.error('主题初始化失败:', error))

type Store = ThemeState & { getState: () => ThemeState }
const facade: Store = {
  get themes() { return controller.getSnapshot().themes },
  get activeId() { return controller.getSnapshot().activeId },
  upsertTheme: controller.upsertTheme.bind(controller),
  updateTokens: controller.updateTokens.bind(controller),
  updateTokensDark: controller.updateTokensDark.bind(controller),
  setExtraCss: controller.setExtraCss.bind(controller),
  renameTheme: controller.renameTheme.bind(controller),
  duplicateTheme: controller.duplicateTheme.bind(controller),
  removeTheme: controller.removeTheme.bind(controller),
  setActive: controller.setActive.bind(controller),
  importTheme: controller.importTheme.bind(controller),
  getState: () => facade,
}

export function useThemeStore<T>(selector: (state: ThemeState) => T): T {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  return selector(facade)
}
useThemeStore.getState = () => facade

type ThemeSelection = Pick<ThemeState, 'themes' | 'activeId'>
export function resolveActiveTheme(state: ThemeSelection): ThemeFile {
  return BUILTIN_THEMES.find((theme) => theme.id === state.activeId) ?? state.themes.find((theme) => theme.id === state.activeId) ?? BUILTIN_THEMES[0]
}
export function listAllThemes(state: ThemeSelection): ThemeFile[] { return [...BUILTIN_THEMES, ...state.themes] }
export { controller as themeController }
