import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 暗色模式开关：作用于整个应用 UI（切 html 的 .dark class）。
 * 主题令牌的明暗两套(ThemeFile.dark)在 PreviewPane 按此状态选择编译。
 */
interface AppearanceState {
  isDark: boolean
  toggleDark: () => void
}

export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      isDark: false,
      toggleDark: () => set((s) => ({ isDark: !s.isDark })),
    }),
    {
      name: 'themd-appearance',
      // 状态驱动 class,避免渲染期副作用
      onRehydrateStorage: () => (state) => {
        document.documentElement.classList.toggle('dark', !!state?.isDark)
      },
    },
  ),
)

/** 订阅 class 同步(运行时切换) */
if (typeof window !== 'undefined') {
  useAppearance.subscribe((state) => {
    document.documentElement.classList.toggle('dark', state.isDark)
  })
}
