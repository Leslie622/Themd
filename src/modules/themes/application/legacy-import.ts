import type { ThemeController } from './theme-controller'
import type { ThemeFile } from '@/lib/theme/schema'

export function importLegacyThemes(controller: ThemeController, storage: Storage = localStorage): number {
  const raw = storage.getItem('themd-themes')
  if (!raw) return 0
  try {
    const parsed = JSON.parse(raw) as { state?: { themes?: ThemeFile[]; activeId?: string } }
    const themes = (parsed.state?.themes ?? []).filter((theme) => !theme.builtin)
    controller.importSnapshot({ schemaVersion: 1, themes, activeId: parsed.state?.activeId ?? 'default' })
    return themes.length
  } catch {
    return 0
  }
}
