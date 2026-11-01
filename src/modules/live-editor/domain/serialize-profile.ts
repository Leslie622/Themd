/**
 * 序列化风格档案(domain 层,纯函数):dirty 块重新序列化时,输出风格
 * 跟随全文原有风格——全文用 `*` 列表/`__粗体__`,编辑过的块也照此写回,
 * 把「编辑引入的非语义 diff」压到最低(P3,方案 §4.4)。
 *
 * 档案在 parse 期从原文统计;未覆盖的风格差异(如 Setext→ATX)由
 * sourceMap 原文兜底(未编辑块)与 P5 收尾。
 */

export interface SerializeProfile {
  /** 无序列表标记 */
  bullet: '-' | '*' | '+'
  /** 粗体标记 */
  strong: '**' | '__'
  /** 斜体标记 */
  em: '*' | '_'
  /** 行尾风格(合成块/重序列化块的换行跟随全文) */
  eol: '\n' | '\r\n'
}

const DEFAULT_PROFILE: SerializeProfile = { bullet: '-', strong: '**', em: '*', eol: '\n' }

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re)
  return m ? m.length : 0
}

/** 统计原文风格:各维度取出现次数多者(同票/为零回落 CommonMark 惯例) */
export function buildProfile(content: string): SerializeProfile {
  const bullets = { '-': 0, '*': 0, '+': 0 } as Record<'-' | '*' | '+', number>
  for (const m of content.matchAll(/^ {0,3}([-*+]) /gm)) {
    bullets[m[1] as '-' | '*' | '+']++
  }
  const bullet = (['-', '*', '+'] as const)
    .filter((c) => bullets[c] > 0)
    .sort((a, b) => bullets[b] - bullets[a])[0] ?? '-'
  const strong = countMatches(content, /\*\*[^*\n]+\*\*/g) >= countMatches(content, /__[^_\n]+__/g)
    ? '**'
    : '__'
  const em = countMatches(content, /(^|[^*])\*[^*\n]+\*(?![*])/g) >= countMatches(content, /(^|[^_\w])_[^_\n]+_(?![_\w])/g)
    ? '*'
    : '_'
  // esbuild 低目标不支持后行断言,裸 LF 数 = 全部 LF - CRLF 数
  const crlf = countMatches(content, /\r\n/g)
  const allLf = countMatches(content, /\n/g)
  const eol = crlf > allLf - crlf ? '\r\n' : '\n'
  return { bullet, strong, em, eol }
}

/**
 * 序列化产物应用列表标记风格。只动行首 `- `;围栏块整体跳过
 * (代码内的 `- ` 注释等不属于 markdown 标记)。
 */
export function applyBulletStyle(text: string, bullet: '-' | '*' | '+'): string {
  if (bullet === '-') return text
  if (/^(```|~~~)/.test(text.trimStart())) return text
  return text.replace(/^([ \t]*)- /gm, `$1${bullet} `)
}

/** 序列化产物统一行尾(dirty 块内部换行跟随全文风格;块尾终止符在外层拼) */
export function applyEol(text: string, eol: '\n' | '\r\n'): string {
  return eol === '\n' ? text : text.replace(/\r?\n/g, eol)
}

export { DEFAULT_PROFILE }
