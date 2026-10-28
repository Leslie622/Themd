import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 编辑器设置(字体大小)。持久化 key `themd-editor`;
 * 字号注入为 html 上的 --font-editor-size,index.css 的 .cm-editor 消费。
 */
interface EditorPrefsState {
  /** CodeMirror 字号(px) */
  fontSize: number
  setFontSize: (px: number) => void
}

const MIN = 11
const MAX = 22
const applySize = (px: number) => {
  document.documentElement.style.setProperty('--font-editor-size', `${px}px`)
}

export const useEditorPrefs = create<EditorPrefsState>()(
  persist(
    (set) => ({
      fontSize: 13.5,
      setFontSize: (px) => {
        const clamped = Math.min(MAX, Math.max(MIN, Math.round(px * 2) / 2))
        applySize(clamped)
        set({ fontSize: clamped })
      },
    }),
    {
      name: 'themd-editor',
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state) applySize(state.fontSize)
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  applySize(useEditorPrefs.getState().fontSize)
  useEditorPrefs.subscribe((s) => applySize(s.fontSize))
}

export const EDITOR_FONT_RANGE = { MIN, MAX } as const
