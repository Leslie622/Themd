/**
 * 代码高亮(静态渲染共享件):已注册语言返回 hljs 转义后的 HTML,
 * 否则返回 ''(调用方自行转义)。从 markdown-renderer 拆出——
 * markdown-it 降级测试 oracle(渲染统一第 5 步)后,静态序列化器
 * (static-html)与 md-it oracle 仍须走同一函数保证字节同源。
 *
 * 只注册常用语言,避免把整个 highlight.js(200+ 语言、2MB+)打进主包。
 */
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import ini from 'highlight.js/lib/languages/ini'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import lua from 'highlight.js/lib/languages/lua'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import plaintext from 'highlight.js/lib/languages/plaintext'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import scss from 'highlight.js/lib/languages/scss'
import shell from 'highlight.js/lib/languages/shell'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

for (const [name, lang] of Object.entries({
  bash,
  c,
  cpp,
  csharp,
  css,
  diff,
  dockerfile,
  go,
  ini,
  java,
  javascript,
  json,
  kotlin,
  lua,
  markdown,
  php,
  plaintext,
  python,
  ruby,
  rust,
  scss,
  shell,
  sql,
  swift,
  typescript,
  xml,
  yaml,
})) {
  hljs.registerLanguage(name, lang)
}

/**
 * 代码块语言选择清单(语言选择浮层数据源,与高亮注册表同一批语言名)。
 * mermaid 不入清单——它有独立图表视图,不该从语言菜单进。
 */
export const CODE_LANGUAGES: ReadonlyArray<string> = [
  'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'dockerfile', 'go', 'ini',
  'java', 'javascript', 'json', 'kotlin', 'lua', 'markdown', 'php',
  'plaintext', 'python', 'ruby', 'rust', 'scss', 'shell', 'sql', 'swift',
  'typescript', 'xml', 'yaml',
]

/**
 * 语言显示名(浮层/header 标签用,fence 值仍小写——源码兼容不变)。
 */
const DISPLAY_NAMES: Record<string, string> = {
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  diff: 'Diff',
  dockerfile: 'Dockerfile',
  go: 'Go',
  ini: 'INI',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  kotlin: 'Kotlin',
  lua: 'Lua',
  markdown: 'Markdown',
  php: 'PHP',
  plaintext: 'Text',
  python: 'Python',
  ruby: 'Ruby',
  rust: 'Rust',
  scss: 'SCSS',
  shell: 'Shell',
  sql: 'SQL',
  swift: 'Swift',
  typescript: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
}

/** fence 语言值 → 显示名;常用缩写别名先归一,清单外语言原样返回(首字母大写兜底) */
export function displayLanguage(lang: string): string {
  const lower = lang.toLowerCase()
  const aliased = ALIAS_TO_CANON[lower]
  if (aliased) return DISPLAY_NAMES[aliased]
  const known = DISPLAY_NAMES[lower]
  if (known) return known
  if (!lang) return 'text'
  return lang.charAt(0).toUpperCase() + lang.slice(1)
}

/** 常用 fence 缩写 → 清单规范名(存量笔记里 ```ts/```js 这类写法的显示归一) */
const ALIAS_TO_CANON: Record<string, string> = {
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
  text: 'plaintext',
  txt: 'plaintext',
}

export function highlightCode(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang }).value
    } catch {
      // 高亮失败时回退为纯文本
    }
  }
  return ''
}
