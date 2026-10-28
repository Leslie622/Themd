import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { BUILTIN_THEMES } from '@/lib/theme/builtin'
import { throttledStateStorage } from '@/lib/throttled-storage'
import type { ThemeFile, ThemeState } from '@/lib/theme/schema'
import type { ThemeTokens } from '@/lib/theme/tokens'

export { BUILTIN_THEMES }

/**
 * 主题状态。用户主题持久化到 localStorage key `themd-themes`；
 * 内置主题（极简/GitHub）随代码发布，每次启动与用户列表合并，不可删除。
 * 内置主题的「就地修改」= 自动先复制为副本再改（updateTokens 里处理），
 * 内置原件永远不动。
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themes: [],
      activeId: 'default',

      upsertTheme: (theme) =>
        set((s) => ({
          themes: s.themes.some((t) => t.id === theme.id)
            ? s.themes.map((t) => (t.id === theme.id ? theme : t))
            : [...s.themes, theme],
        })),

      /** 设置某主题的令牌。内置主题自动先复制为「×× 副本」再改，并切换到副本 */
      updateTokens: (id, tokens) => {
        const builtin = BUILTIN_THEMES.find((t) => t.id === id)
        if (builtin) {
          const copy: ThemeFile = {
            ...builtin,
            version: 1,
            id: crypto.randomUUID(),
            name: `${builtin.name} 副本`,
            builtin: false,
            tokens: { ...tokens },
          }
          set((s) => ({ themes: [...s.themes, copy], activeId: copy.id }))
          return copy.id
        }
        set((s) => ({
          themes: s.themes.map((t) => (t.id === id ? { ...t, tokens: { ...tokens } } : t)),
        }))
        return id
      },

      renameTheme: (id, name) =>
        set((s) => ({
          themes: s.themes.map((t) => (t.id === id ? { ...t, name } : t)),
        })),

      duplicateTheme: (id) => {
        const source =
          get().themes.find((t) => t.id === id) ?? BUILTIN_THEMES.find((t) => t.id === id)
        if (!source) return null
        const copy: ThemeFile = {
          ...source,
          version: 1,
          id: crypto.randomUUID(),
          name: `${source.name} 副本`,
          builtin: false,
          tokens: { ...source.tokens },
        }
        set((s) => ({ themes: [...s.themes, copy] }))
        return copy.id
      },

      removeTheme: (id) =>
        set((s) => ({
          themes: s.themes.filter((t) => t.id !== id),
          activeId: s.activeId === id ? 'default' : s.activeId,
        })),

      setActive: (id) => set({ activeId: id }),

      /** 设置主题的暗色令牌套(ThemeFile.dark)。内置主题自动先复制,返回实际生效 id */
      updateTokensDark: (id, tokens) => {
        const source =
          BUILTIN_THEMES.find((t) => t.id === id) ?? get().themes.find((t) => t.id === id)
        if (!source) return id
        if (source.builtin) {
          const copy: ThemeFile = {
            ...source,
            version: 1,
            id: crypto.randomUUID(),
            name: `${source.name} 副本`,
            builtin: false,
            tokens: { ...source.tokens },
            dark: { ...tokens },
          }
          set((s) => ({ themes: [...s.themes, copy], activeId: copy.id }))
          return copy.id
        }
        set((s) => ({
          themes: s.themes.map((t) => (t.id === id ? { ...t, dark: { ...tokens } } : t)),
        }))
        return id
      },

      /** 设置附加 CSS。内置主题自动先复制为副本并激活，返回实际生效的主题 id */
      setExtraCss: (id, css) => {
        const builtin = BUILTIN_THEMES.find((t) => t.id === id)
        if (builtin) {
          const copy: ThemeFile = {
            ...builtin,
            version: 1,
            id: crypto.randomUUID(),
            name: `${builtin.name} 副本`,
            builtin: false,
            tokens: { ...builtin.tokens },
            extraCss: css || undefined,
          }
          set((s) => ({ themes: [...s.themes, copy], activeId: copy.id }))
          return copy.id
        }
        set((s) => ({
          themes: s.themes.map((t) =>
            t.id === id ? { ...t, extraCss: css || undefined } : t,
          ),
        }))
        return id
      },

      /** 导入 .themd.json：新 id 入库并激活；解析失败返回 null */
      importTheme: (raw) => {
        try {
          const data = JSON.parse(raw) as {
            version?: number
            name?: string
            tokens?: ThemeTokens
          }
          if (typeof data !== 'object' || data === null || !data.name) return null
          const theme: ThemeFile = {
            version: 1,
            id: crypto.randomUUID(),
            name: data.name,
            tokens: data.tokens ?? {},
          }
          set((s) => ({ themes: [...s.themes, theme], activeId: theme.id }))
          return theme.id
        } catch {
          return null
        }
      },
    }),
    {
      name: 'themd-themes',
      version: 1,
      // 取色器拖动等高频 set:落盘节流,避免同步 IO 卡顿。
      // createJSONStorage 负责 JSON 序列化;节流层只碰字符串
      storage: createJSONStorage(() => throttledStateStorage),
      // 只持久化用户数据；builtin 主题重新从代码合并（保证随版本更新）
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<ThemeState>
        const userThemes = (saved.themes ?? []).filter((t) => !t.builtin)
        return {
          ...current,
          themes: userThemes,
          activeId: saved.activeId ?? 'default',
        }
      },
    },
  ),
)

type ThemeSelection = Pick<ThemeState, 'themes' | 'activeId'>

/** 按当前激活 id 解析出完整主题（内置或用户），用于渲染消费 */
export function resolveActiveTheme(state: ThemeSelection): ThemeFile {
  const builtin = BUILTIN_THEMES.find((t) => t.id === state.activeId)
  if (builtin) return builtin
  return state.themes.find((t) => t.id === state.activeId) ?? BUILTIN_THEMES[0]
}

/** 供工场/下拉枚举全部可选主题（内置在前） */
export function listAllThemes(state: ThemeSelection): ThemeFile[] {
  return [...BUILTIN_THEMES, ...state.themes]
}

export type { ThemeFile, ThemeTokens }
