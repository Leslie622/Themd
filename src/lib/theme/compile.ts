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
  // 字体双令牌(latin/cjk)拼合成一条 font-family 栈:latin 在前 cjk 在后,
  // 浏览器按字符自动分流。只设其一 = 另一端走 theme-base.css 回落族,
  // 所以拼栈时用 CSS 端的回落族补齐空端,保证单设也即刻生效
  for (const [base, varPrefix] of FONT_STACKS) {
    const latin = active[`${base}.fontLatin` as TokenKey]
    const cjk = active[`${base}.fontCjk` as TokenKey]
    if (latin !== undefined || cjk !== undefined) {
      vars[varPrefix] = joinFontStack(latin, cjk, FONT_FALLBACK_TAILS[base] ?? 'sans-serif')
    }
  }
  return vars
}

/** 双字体令牌的元素基名 → 编译产出的合并变量名(与 theme-base.css 消费点一致) */
const FONT_STACKS: [string, string][] = [
  ['root', '--t-root-font'],
  ['heading', '--t-heading-font'],
  ['h1', '--t-h1-font'],
  ['h2', '--t-h2-font'],
  ['h3', '--t-h3-font'],
  ['h4', '--t-h4-font'],
  ['h5', '--t-h5-font'],
  ['h6', '--t-h6-font'],
  ['strong', '--t-strong-font'],
  ['em', '--t-em-font'],
  ['del', '--t-del-font'],
  ['a', '--t-a-font'],
  ['inlineCode', '--t-inline-code-font'],
  ['codeBlock', '--t-code-font'],
]

/** 各元素合并栈的尾部回落(与 theme-base.css 原回落尾一致,去 Geist/HarmonyOS 打包族) */
const FONT_FALLBACK_TAILS: Record<string, string> = {
  root: 'system-ui, sans-serif',
  heading: 'inherit',
  h1: 'var(--t-heading-font, inherit)',
  h2: 'var(--t-heading-font, inherit)',
  h3: 'var(--t-heading-font, inherit)',
  h4: 'var(--t-heading-font, inherit)',
  h5: 'var(--t-heading-font, inherit)',
  h6: 'var(--t-heading-font, inherit)',
  strong: 'inherit',
  em: 'inherit',
  del: 'inherit',
  a: 'inherit',
  inlineCode: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
  codeBlock: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
}

/**
 * 字体族名集合 → font-family 栈文本。
 * latin 在前 cjk 在后,浏览器按字符自动分流(西文字体缺汉字时落到中文字体)。
 * 族名去引号统一保存,含空格的重新加引号;跨 latin/cjk 的重复族去重。
 */
function joinFontStack(latin: string | undefined, cjk: string | undefined, fallbackTail: string): string {
  const families: string[] = []
  const pushAll = (v: string | undefined) => {
    for (const f of (v ?? '').split(',')) {
      const t = f.trim().replace(/^['"]|['"]$/g, '')
      if (t && !families.includes(t)) families.push(t)
    }
  }
  pushAll(latin)
  pushAll(cjk)
  for (const t of fallbackTail.split(',')) {
    const clean = t.trim()
    if (!clean) continue
    const bare = clean.replace(/^['"]|['"]$/g, '')
    if (!families.includes(bare) && !clean.startsWith('var(')) families.push(bare)
    else if (clean.startsWith('var(')) families.push(clean)
  }
  return families.map((f) => (/\s/.test(f) && !f.startsWith('var(') ? `'${f}'` : f)).join(', ')
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
