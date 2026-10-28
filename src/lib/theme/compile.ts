import { TOKEN_VAR, type ThemeTokens, type TokenKey } from './tokens'

/**
 * 令牌 → CSS 变量。链路只有这一条：
 * store 里的 tokens → compileTokens → PreviewPane 容器 style。
 * 未设置的键不产出变量，theme-base.css 的 var() 回落值即「极简」观感。
 * dark 参数：主题有暗色令牌套且当前处于暗色模式时，用 dark 套编译。
 */
export function compileTokens(
  tokens: ThemeTokens,
  darkTokens?: ThemeTokens,
  isDark = false,
): Record<string, string> {
  const active = isDark && darkTokens ? darkTokens : tokens
  const vars: Record<string, string> = {}
  for (const [key, varName] of Object.entries(TOKEN_VAR)) {
    const value = active[key as TokenKey]
    if (value !== undefined && value !== '') {
      vars[varName] = value
    }
  }
  // a.underline 是策略值（always/hover/none），展开为两个实际变量
  const underline = active['a.underline']
  delete vars['--t-a-underline']
  if (underline === 'always') {
    vars['--t-a-underline-line'] = 'underline'
    vars['--t-a-hover-underline'] = 'underline'
  } else if (underline === 'none') {
    vars['--t-a-underline-line'] = 'none'
    vars['--t-a-hover-underline'] = 'none'
  } else if (underline === 'hover') {
    vars['--t-a-underline-line'] = 'none'
    vars['--t-a-hover-underline'] = 'underline'
  }
  return vars
}

/** 导出用：令牌解析为 CSS 变量声明文本 */
export function tokensToCss(tokens: ThemeTokens): string {
  return Object.entries(TOKEN_VAR)
    .map(([key, varName]) => {
      const value = tokens[key as TokenKey]
      return value !== undefined && value !== ''
        ? `${varName}: ${value};`
        : null
    })
    .filter((line): line is string => line !== null)
    .join('\n')
}

/**
 * 附加 CSS（extraCss）作用域包装。
 * 用户/导入的 CSS 按约定写元素选择器（strong { … }），
 * 注入时统一包一层 .themd-prose 限定作用域，永不污染应用界面。
 * 已含 .themd-prose / #write 前缀的规则改写前缀而非重复包装。
 */
export function scopeExtraCss(css: string): string {
  const trimmed = css.trim()
  if (!trimmed) return ''
  // 已带容器作用域的(如 CSS 导入时改写过的)只换前缀
  if (/(^|[},])\s*\.themd-prose/.test(trimmed) || /#write/.test(trimmed)) {
    return trimmed.replace(/#write/g, '.themd-prose')
  }
  // 逐条规则包装:选择器前加 .themd-prose(处理 @media 整块原样缩进包装)
  return trimmed.replace(/(^|})\s*([^{}@]+)\{/g, (_m, brace, sel) =>
    `${brace}\n.themd-prose ${sel.trim()}{`.replace(/\n{2,}/g, '\n'),
  )
}

/** 附加 CSS 的 <style> 内容（含主题隔离注释头） */
export function extraCssToStyle(themeId: string, css: string): string {
  const scoped = scopeExtraCss(css)
  return scoped ? `/* themd-extra:${themeId} */\n${scoped}` : ''
}
