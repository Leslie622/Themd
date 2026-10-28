import type { ThemeTokens } from './tokens'

/** 主题文件（导入导出格式即此结构 + version）。dark 为可选的暗色令牌套（P5） */
export interface ThemeFile {
  version: 1
  id: string
  name: string
  /** 内置主题：随代码发布，不占用户存储、不可删除；修改时自动先复制 */
  builtin?: boolean
  tokens: ThemeTokens
  /** 暗色令牌套：应用切到暗色模式时优先使用（未设置的键回落 tokens） */
  dark?: ThemeTokens
  /** 附加自定义 CSS（P4 启用，schema 先就位） */
  extraCss?: string
}

export interface ThemeState {
  themes: ThemeFile[]
  /** 当前激活主题 id；'default' = 内置极简 */
  activeId: string
  upsertTheme: (theme: ThemeFile) => void
  /** 内置主题更新令牌时自动先复制为副本并激活，返回实际生效的主题 id */
  updateTokens: (id: string, tokens: ThemeTokens) => string
  /** 更新暗色令牌套；内置主题同样自动先复制，返回实际生效的主题 id */
  updateTokensDark: (id: string, tokens: ThemeTokens) => string
  /** 设置附加 CSS；内置主题同样自动先复制，返回实际生效的主题 id */
  setExtraCss: (id: string, css: string) => string
  renameTheme: (id: string, name: string) => void
  duplicateTheme: (id: string) => string | null
  removeTheme: (id: string) => void
  setActive: (id: string) => void
  importTheme: (raw: string) => string | null
}
