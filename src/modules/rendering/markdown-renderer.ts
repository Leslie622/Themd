/**
 * markdown-it oracle(渲染统一第 5 步降级:仅测试链消费,不进生产 import 图)。
 * 角色:金样语料的规范记录——golden-corpus.test 用它对冻结期望 HTML 逐字节
 * 守门,TipTap 管线(static-html)拿它对答案。生产渲染一律走 renderStaticHtml。
 * slug/highlightCode 等共享纯函数已拆至 slug.ts / code-highlight.ts。
 */
import MarkdownIt from 'markdown-it'
import type { StateCore } from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { katex as katexPlugin } from '@mdit/plugin-katex'
import { gfmAlerts } from './gfm-alerts'
import { resolveImageSrcSync } from '@/lib/image-src'
import { highlightCode } from './code-highlight'
import { slug } from './slug'

export const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  // 段内单个换行渲染为 <br>(Typora/Obsidian 同款)。CommonMark 默认把软换行
  // 折叠成空格,笔记场景里「敲了换行预览却不换」非常反直觉
  breaks: true,
  highlight: highlightCode,
}).use(taskLists).use(katexPlugin).use(gfmAlerts)

/**
 * 契约 §3 任务列表(2026-11-03 修订):markdown-it-task-lists 只吞 `[ ]` 三字符,
 * 源码空格留在正文首文本里 → 预览间距 = margin + 空格双份;PM 解析吃前导空白,
 * 编辑面 = margin 单份。契约定间距由 input 的 margin-right 独自承担,
 * 此处剥除首文本的前导空格,md-it 侧与静态序列化器/编辑面三面同构。
 */
function taskGapRule(state: StateCore): void {
  for (const token of state.tokens) {
    if (token.type !== 'inline' || !token.children) continue
    const checkbox = token.children[0]
    const text = token.children[1]
    if (
      checkbox?.type === 'html_inline' &&
      checkbox.content.startsWith('<input class="task-list-item-checkbox"') &&
      text?.type === 'text' &&
      text.content.startsWith(' ')
    ) {
      text.content = text.content.replace(/^ +/, '')
    }
  }
}
md.core.ruler.push('themd_task_gap', taskGapRule)

// ============================================================
// 自定义渲染规则：想把 md 渲染成「自己喜欢的 HTML」，就在这里改。
// 每种语法元素（标题/代码块/引用/图片…）都有一个 rule 函数可覆盖。
// ============================================================

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

// mermaid fence → 占位容器(渲染期同步输出源码兜底,PreviewPane 挂载后
// 异步渲染 SVG 并替换;实时编辑侧经 codeblock-cm 的图表视图走同一渲染模块)
const defaultFence = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  if (token.info.trim().toLowerCase() === 'mermaid') {
    const code = md.utils.escapeHtml(token.content)
    return `<div class="themd-mermaid" data-src="${encodeURIComponent(token.content)}">${code}</div>`
  }
  return defaultFence ? defaultFence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
}

// 图片:懒加载 + 异步解码(内嵌 base64 的截图可能很大,预览首屏别被拖住)。
// assets/ 相对路径在渲染时同步改写为可加载的真实地址(桌面端 asset:// 协议,
// 见 lib/image-src.ts)——解析依赖已注入的根目录与 convertFileSrc,
// 这里用缓存的同步版本避免 renderer 引入异步复杂度。
// 注意 alt 要从子节点提取(renderInlineAsText)——直接 renderToken 会丢掉它
md.renderer.rules.image = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  token.attrSet('loading', 'lazy')
  token.attrSet('decoding', 'async')
  const src = token.attrGet('src')
  if (typeof src === 'string') token.attrSet('src', resolveImageSrcSync(src))
  if (token.children) {
    token.attrSet('alt', self.renderInlineAsText(token.children, options, _env))
  }
  return self.renderToken(tokens, idx, options)
}


export interface RenderedDocument { source: string; html: string }
export function renderMarkdown(source: string): RenderedDocument { return { source, html: md.render(source) } }
