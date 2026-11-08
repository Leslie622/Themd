import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import {
  SiTypescript, SiJavascript, SiPython, SiRust, SiGo, SiGnubash, SiLua,
  SiJson, SiYaml, SiCss, SiSass, SiMarkdown, SiPhp, SiRuby, SiSwift,
  SiKotlin, SiOpenjdk, SiC, SiCplusplus, SiDotnet, SiDocker, SiShell,
  SiMysql, SiXml, SiToml,
} from '@icons-pack/react-simple-icons'

/**
 * 语言图标 SVG 序列化(共享层):simple-icons 官方图形 + Si*Hex 官方色值,
 * renderToStaticMarkup 出字节级稳定的纯 SVG 字符串。三方同源:
 * - 规范 HTML(static-html / md-it oracle):header 语言名前的彩色图标,
 *   随导出带到独立 HTML/PDF;
 * - 编辑面(codeblock-cm NodeView):innerHTML 同一字符串;
 * - 浮层列表(language-picker)走 language-icons.tsx 的 React 组件(同数据)。
 * 缓存:每语言序列化一次(Map),规范 HTML 高频渲染零重复成本。
 */

interface LangIconDef {
  Icon: (props: { size?: number; color?: string }) => ReactNode
  color: string
}

const LANGUAGE_ICONS: Record<string, LangIconDef> = {
  bash: { Icon: SiGnubash, color: '#4EAA25' },
  c: { Icon: SiC, color: '#A8B9CC' },
  cpp: { Icon: SiCplusplus, color: '#00599C' },
  csharp: { Icon: SiDotnet, color: '#512BD4' },
  css: { Icon: SiCss, color: '#663399' },
  dockerfile: { Icon: SiDocker, color: '#2496ED' },
  go: { Icon: SiGo, color: '#00ADD8' },
  java: { Icon: SiOpenjdk, color: '#000000' },
  javascript: { Icon: SiJavascript, color: '#F7DF1E' },
  json: { Icon: SiJson, color: '#000000' },
  kotlin: { Icon: SiKotlin, color: '#7F52FF' },
  lua: { Icon: SiLua, color: '#000080' },
  markdown: { Icon: SiMarkdown, color: '#000000' },
  php: { Icon: SiPhp, color: '#777BB4' },
  python: { Icon: SiPython, color: '#3776AB' },
  ruby: { Icon: SiRuby, color: '#CC342D' },
  rust: { Icon: SiRust, color: '#000000' },
  scss: { Icon: SiSass, color: '#CC6699' },
  shell: { Icon: SiShell, color: '#FFD500' },
  sql: { Icon: SiMysql, color: '#4479A1' },
  swift: { Icon: SiSwift, color: '#F05138' },
  toml: { Icon: SiToml, color: '#9C4121' },
  typescript: { Icon: SiTypescript, color: '#3178C6' },
  xml: { Icon: SiXml, color: '#005FAD' },
  yaml: { Icon: SiYaml, color: '#CB171E' },
}

/** 与 code-highlight ALIAS_TO_CANON 同步的缩写表(只列有品牌图的) */
const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  py: 'python',
  rb: 'ruby',
  sh: 'shell',
  yml: 'yaml',
  md: 'markdown',
  rs: 'rust',
  golang: 'go',
  docker: 'dockerfile',
  'c++': 'cpp',
  'c#': 'csharp',
  kt: 'kotlin',
}

const ICON_SIZE = 12
const svgCache = new Map<string, string | null>()

/**
 * fence 语言值 → 内联 SVG 字符串(official 图形+色);无品牌图返回 null,
 * 调用方跳过图标(纯文本标签)。序列化固定 size/色值,字节稳定。
 */
export function languageIconSvg(lang: string): string | null {
  const lower = lang.toLowerCase()
  const canon = LANGUAGE_ALIASES[lower] ?? lower
  if (svgCache.has(canon)) return svgCache.get(canon) ?? null
  const def = LANGUAGE_ICONS[canon]
  if (!def) {
    svgCache.set(canon, null)
    return null
  }
  const svg = renderToStaticMarkup(
    <def.Icon size={ICON_SIZE} color={def.color} />,
  )
  svgCache.set(canon, svg)
  return svg
}
