/**
 * 实时图片节点(P4d):attrs 保持 markdown 原始 src + 尺寸(width/height)。
 *
 * - 尺寸语法 `![alt](src =300x200)` 是 markdown-it(预览/导出)原生支持的
 *   扩展;marked(CommonMark 严格)不认,标准 image tokenizer 会整体解析失败,
 *   这里用自定义 inline tokenizer 优先接管带尺寸形式,标准形式仍走官方。
 * - 序列化:无尺寸时委托官方 renderMarkdown(与 P0 基线零差异);带尺寸时
 *   吐 `![alt](src =WxH)`。
 * - NodeView:右下角拖拽手柄调宽(等比推 height),松手一次事务写回 attrs
 *   → dirty 块序列化带尺寸后缀,字节往返稳定。
 */
import Image from '@tiptap/extension-image'
import type { NodeViewRendererProps } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { EditorView as PMEditorView } from '@tiptap/pm/view'
import type { ViewMutationRecord } from '@tiptap/pm/view'

import { resolveImageSrcSync } from '@/lib/image-src'

/** 尺寸串:` =300x` / ` =300x200` / ` =x200`;无尺寸返回 '' */
function sizeSuffix(attrs: Record<string, unknown>): string {
  const w = attrs.width as number | null | undefined
  const h = attrs.height as number | null | undefined
  if (!w && !h) return ''
  return ` =${w ?? ''}x${h ?? ''}`
}

class ImageResizeView {
  dom: HTMLElement
  private img: HTMLImageElement
  private handle: HTMLElement
  private node: PMNode
  private view: PMEditorView
  private getPos: () => number | undefined

  constructor(props: NodeViewRendererProps) {
    this.node = props.node
    this.view = props.view
    this.getPos = props.getPos
    this.dom = document.createElement('span')
    this.dom.className = 'live-image'
    this.img = document.createElement('img')
    this.applyAttrs()
    this.handle = document.createElement('span')
    this.handle.className = 'live-image-handle'
    this.handle.title = '拖拽调整宽度'
    this.handle.addEventListener('mousedown', (e) => this.startDrag(e))
    this.dom.append(this.img, this.handle)
  }

  private applyAttrs(): void {
    const { src, alt, title, width, height } = this.node.attrs as {
      src?: string | null
      alt?: string | null
      title?: string | null
      width?: number | null
      height?: number | null
    }
    if (typeof src === 'string') this.img.src = resolveImageSrcSync(src)
    this.img.alt = alt ?? ''
    if (title) this.img.title = title
    if (width) this.img.style.width = `${width}px`
    else this.img.style.width = ''
    if (height) this.img.style.height = `${height}px`
    else this.img.style.height = ''
  }

  private startDrag(e: MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startWidth = this.img.getBoundingClientRect().width
    const ratio = this.img.naturalWidth
      ? this.img.naturalHeight / this.img.naturalWidth
      : 0
    const move = (ev: MouseEvent) => {
      const w = Math.max(40, Math.round(startWidth + ev.clientX - startX))
      this.img.style.width = `${w}px`
      if (ratio) this.img.style.height = `${Math.round(w * ratio)}px`
    }
    const up = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      const pos = this.getPos()
      if (typeof pos !== 'number') return
      const width = Math.max(40, Math.round(startWidth + ev.clientX - startX))
      const height = ratio ? Math.round(width * ratio) : null
      // 单事务写回 attrs:等比高度跟随,同一次 undo 可撤
      this.view.dispatch(
        this.view.state.tr.setNodeMarkup(pos, undefined, {
          ...this.node.attrs,
          width,
          height,
        }),
      )
      this.view.focus()
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.applyAttrs()
    return true
  }

  selectNode(): void {
    this.dom.classList.add('live-image-selected')
  }

  deselectNode(): void {
    this.dom.classList.remove('live-image-selected')
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.type !== 'selection'
  }

  destroy(): void {
    // 全局监听在 up 里必然移除;此处兜底拖拽中途节点销毁
  }
}

export const LiveImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      height: { default: null },
    }
  },

  renderMarkdown(node, h, ctx) {
    // 无尺寸 → 官方实现(保持 P0 基线零差异);带尺寸 → 追加 =WxH
    const parent = this.parent
    const attrs = node.attrs ?? {}
    if (!attrs.width && !attrs.height) {
      return parent
        ? parent.call(this, node, h, ctx)
        : `![${attrs.alt ?? ''}](${attrs.src ?? ''})`
    }
    const base = parent
      ? parent.call(this, node, h, ctx)
      : `![${attrs.alt ?? ''}](${attrs.src ?? ''})`
    // base 形如 ![alt](src) 或 ![alt](src "title"):闭括号前插尺寸
    return `${base.slice(0, -1)}${sizeSuffix(attrs)})`
  },

  markdownTokenizer: {
    name: 'sizedImage',
    level: 'inline' as const,
    start: (src: string) => src.indexOf('!['),
    tokenize(src: string) {
      // 仅接管带 =WxH 后缀的形式(标准形式返回 undefined 走官方 tokenizer)。
      // token.type 必须是 'image':管理器按 token.type 路由到 Image 的
      // parseMarkdown,自定义类型无人认领(实测)
      const m = /^!\[([^\]]*)\]\((\S+)(?:\s+"([^"]*)")?\s+=(\d*)x(\d*)\)(?!\()/.exec(src)
      if (!m) return undefined
      return {
        type: 'image',
        raw: m[0],
        href: m[2],
        text: m[1],
        title: m[3] ?? '',
        width: m[4] ? Number(m[4]) : null,
        height: m[5] ? Number(m[5]) : null,
      }
    },
  },

  parseMarkdown(token, h) {
    // 标准与带尺寸都走官方(官方 token 形状 href/text/title);带尺寸再补 attrs
    const parent = this.parent
    const result = parent
      ? parent.call(this, token, h)
      : h.createNode('image', { src: (token as { href?: string }).href ?? '' })
    const t = token as { width?: number | null; height?: number | null }
    if ((t.width ?? null) || (t.height ?? null)) {
      const node = Array.isArray(result) ? result[0] : result
      if (node && typeof node === 'object') {
        node.attrs = {
          ...(node.attrs ?? {}),
          width: t.width ?? null,
          height: t.height ?? null,
        }
      }
    }
    return result
  },

  addNodeView() {
    return (props: NodeViewRendererProps) => new ImageResizeView(props)
  },
})
