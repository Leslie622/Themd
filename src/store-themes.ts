/**
 * 主题状态的 React 绑定层:useThemeStore(selector) 订阅 ThemeController 快照,
 * 命令经 themeController 直连;resolveActiveTheme/listAllThemes 是消费方共用的
 * 主题解析(内置 + 用户主题合并视图)。ThemeController 是主题事实来源。
 */
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

/** 解析笔记生效主题:笔记级覆盖 > 全局激活;覆盖 id 失效(主题已删)回落全局 */
export function resolveNoteTheme(state: ThemeSelection, noteThemeId: string | undefined | null): ThemeFile {
  if (noteThemeId) {
    const overridden = listAllThemes(state).find((t) => t.id === noteThemeId)
    if (overridden) return overridden
  }
  return resolveActiveTheme(state)
}
export { controller as themeController }
