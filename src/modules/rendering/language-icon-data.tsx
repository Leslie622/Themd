import type { ReactNode } from 'react'
import {
  SiTypescript, SiJavascript, SiPython, SiRust, SiGo, SiGnubash, SiLua,
  SiJson, SiYaml, SiCss, SiSass, SiMarkdown, SiPhp, SiRuby, SiSwift,
  SiKotlin, SiOpenjdk, SiC, SiCplusplus, SiDotnet, SiDocker, SiShell,
  SiMysql, SiXml, SiToml,
} from '@icons-pack/react-simple-icons'

/**
 * 代码块语言图标数据(单一来源):simple-icons 官方图形 + 官方品牌色
 * (色值取自包内配套的 Si*Hex 导出 = official defaultColor,不做任何调整)。
 * 两个消费视图共用:
 * - language-icon-svg.tsx:序列化成内联 SVG 字符串(规范 HTML / 编辑器 NodeView);
 * - language-icons.tsx:React 组件(语言选择浮层)。
 * fence 语言值的别名归一统一走 code-highlight 的 LANGUAGE_ALIAS_TO_CANON。
 */
export interface LangIconDef {
  Icon: (props: { size?: number; color?: string }) => ReactNode
  color: string
}

export const LANGUAGE_ICONS: Record<string, LangIconDef> = {
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
