import type { ReactNode } from 'react'
import { IconFileCode2 } from '@tabler/icons-react'
import {
  SiTypescript, SiJavascript, SiPython, SiRust, SiGo, SiGnubash, SiLua,
  SiJson, SiYaml, SiCss, SiSass, SiMarkdown, SiPhp, SiRuby, SiSwift,
  SiKotlin, SiOpenjdk, SiC, SiCplusplus, SiDotnet, SiDocker, SiShell,
  SiMysql, SiXml, SiToml,
} from '@icons-pack/react-simple-icons'

/**
 * 代码块语言图标(语言选择浮层用):simple-icons 官方图形 + 官方品牌色
 * (色值取自包内配套的 Si*Hex 导出=official defaultColor,不做任何调整)。
 * simple-icons 的 Si*Hex 是色值字符串非组件;彩色 = 单色组件传 color。
 * 没有官方品牌图的语言用语义最近的品牌兜底(SQL→MySQL)/tabler 通用
 * IconFileCode2 兜底(灰色)。fence 语言值(小写)→ { Icon, color }。
 */
interface LangIcon {
  Icon: (props: { size?: number; color?: string }) => ReactNode
  color: string
}

export const LANGUAGE_ICONS: Record<string, LangIcon> = {
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

/** 取语言图标(常用缩写别名归一后查表);清单外统一通用码文件图标 */
export function languageIcon(lang: string): LangIcon {
  const lower = lang.toLowerCase()
  const aliased = LANGUAGE_ALIASES[lower]
  return LANGUAGE_ICONS[aliased ?? lower] ?? { Icon: IconFileCode2, color: 'currentColor' }
}

/** 与 code-highlight ALIAS_TO_CANON 同步的图标侧缩写表(只列有品牌图的) */
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
