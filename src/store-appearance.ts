import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 暗色模式开关：作用于整个应用 UI（切 html 的 .dark class）。
 * 主题令牌的明暗两套(ThemeFile.dark)在 PreviewPane 按此状态选择编译。
 */
interface AppearanceState {
  isDark: boolean
  toggleDark: () => void
  setDark: (value: boolean) => void
}

/** 把 isDark 同步到 html.dark(滚动条等全局样式跟随明暗令牌) */
function applyDarkClass(isDark: boolean) {
  document.documentElement.classList.toggle('dark', isDark)
}

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      isDark: false,
      toggleDark: () => set((s) => ({ isDark: !s.isDark })),
      setDark: (isDark) => set({ isDark }),
    }),
    {
      name: 'themd/ui-appearance/v1',
      version: 1,
      onRehydrateStorage: () => (state) => {
        applyDarkClass(!!state?.isDark)
      },
    },
  ),
)

/** 运行时切换同步 + 模块加载即兜底一次(水合时序无关,防 class 丢失) */
if (typeof window !== 'undefined') {
  applyDarkClass(useAppearance.getState().isDark)
  useAppearance.subscribe((state) => {
    applyDarkClass(state.isDark)
  })
}
