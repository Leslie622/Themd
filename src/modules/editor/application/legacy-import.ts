export interface LegacyPreferenceImport {
  editor: {
    fontSize?: number
    uiFontWestern?: string
    uiFontCjk?: string
    editorFontWestern?: string
    editorFontCjk?: string
    foldEnabled?: boolean
    syncScrollEnabled?: boolean
    lineWrapEnabled?: boolean
  }
  isDark?: boolean
}

/** 只由用户主动点击恢复入口调用，读取旧版编辑器与外观键。 */
export function importLegacyPreferences(storage: Storage = localStorage): LegacyPreferenceImport {
  const result: LegacyPreferenceImport = { editor: {} }
  try {
    const editorRaw = storage.getItem('themd-editor')
    if (editorRaw) {
      const saved = JSON.parse(editorRaw) as { state?: LegacyPreferenceImport['editor'] }
      result.editor = saved.state ?? {}
    }
    const appearanceRaw = storage.getItem('themd-appearance')
    if (appearanceRaw) {
      const saved = JSON.parse(appearanceRaw) as { state?: { isDark?: boolean } }
      result.isDark = saved.state?.isDark
    }
  } catch {
    return { editor: {} }
  }
  return result
}
