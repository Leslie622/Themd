import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
// 只注册常用语言，避免把整个 highlight.js（200+ 语言、2MB+）打进主包
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

export const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  // 段内单个换行渲染为 <br>(Typora/Obsidian 同款)。CommonMark 默认把软换行
  // 折叠成空格,笔记场景里「敲了换行预览却不换」非常反直觉
  breaks: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch {
        // 高亮失败时回退为纯文本
      }
    }
    return '' // 空字符串 = 交给 markdown-it 自己转义输出
  },
}).use(taskLists)

// ============================================================
// 自定义渲染规则：想把 md 渲染成「自己喜欢的 HTML」，就在这里改。
// 每种语法元素（标题/代码块/引用/图片…）都有一个 rule 函数可覆盖。
// ============================================================

const slug = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')

// 示例 1：给所有标题加 id（slug），方便以后做目录、锚点跳转
md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  const text = tokens[idx + 1]?.content ?? ''
  tokens[idx].attrs = [['id', slug(text)]]
  return self.renderToken(tokens, idx, options)
}

// 示例 2（取消注释即可生效）：完全接管代码块，输出自定义结构
// md.renderer.rules.fence = (tokens, idx) => {
//   const token = tokens[idx]
//   const lang = token.info.trim()
//   return `<div class="code-card" data-lang="${lang}"><pre><code>${md.utils.escapeHtml(token.content)}</code></pre></div>`
// }

// 图片:懒加载 + 异步解码(内嵌 base64 的截图可能很大,预览首屏别被拖住)。
// 注意 alt 要从子节点提取(renderInlineAsText)——直接 renderToken 会丢掉它
md.renderer.rules.image = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  token.attrSet('loading', 'lazy')
  token.attrSet('decoding', 'async')
  if (token.children) {
    token.attrSet('alt', self.renderInlineAsText(token.children, options, _env))
  }
  return self.renderToken(tokens, idx, options)
}
