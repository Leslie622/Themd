/**
 * 表格浮动工具条(P4d):光标进入表格时在其上方浮出行列操作条。
 * 纯 PM Plugin + DOM(非 React 语境,观感对齐 shadcn 令牌——同 EditorPane
 * 折叠箭头 markerDOM 先例);命令全部来自官方 Table 扩展。
 */
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import type { EditorState } from '@tiptap/pm/state'

/** 选区所在表格的顶层深度;不在表格返回 -1 */
function tableDepth(state: EditorState): number {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return d
  }
  return -1
}

type TableAction = { label: string; icon: string; run: () => void; danger?: boolean }

const ICONS: Record<string, string> = {
  rowAbove:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="14" width="18" height="7" rx="1"/><path d="M12 3v8m0-8-3 3m3-3 3 3"/></svg>',
  rowBelow:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="7" rx="1"/><path d="M12 21v-8m0 8-3-3m3 3 3-3"/></svg>',
  rowDelete:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="10" width="18" height="7" rx="1"/><path d="M3 3h18"/></svg>',
  colLeft:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="14" y="3" width="7" height="18" rx="1"/><path d="M3 12h8m-8 0 3-3m-3 3 3 3"/></svg>',
  colRight:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><path d="M21 12h-8m8 0-3-3m3 3-3 3"/></svg>',
  colDelete:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="10" y="3" width="7" height="18" rx="1"/><path d="M3 3h18" transform="rotate(90 12 12)"/></svg>',
  header:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M9 4v16"/></svg>',
  tableDelete:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M9 4v16"/></svg>',
}

export const LiveTableMenu = Extension.create({
  name: 'liveTableMenu',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        view(editorView: EditorView) {
          const bar = document.createElement('div')
          bar.className = 'live-table-menu'
          const actions: TableAction[] = [
            { label: '上方插入行', icon: 'rowAbove', run: () => editor.chain().focus().addRowBefore().run() },
            { label: '下方插入行', icon: 'rowBelow', run: () => editor.chain().focus().addRowAfter().run() },
            { label: '删除行', icon: 'rowDelete', run: () => editor.chain().focus().deleteRow().run() },
            { label: '左侧插入列', icon: 'colLeft', run: () => editor.chain().focus().addColumnBefore().run() },
            { label: '右侧插入列', icon: 'colRight', run: () => editor.chain().focus().addColumnAfter().run() },
            { label: '删除列', icon: 'colDelete', run: () => editor.chain().focus().deleteColumn().run() },
            { label: '切换表头行', icon: 'header', run: () => editor.chain().focus().toggleHeaderRow().run() },
            { label: '删除表格', icon: 'tableDelete', run: () => editor.chain().focus().deleteTable().run(), danger: true },
          ]
          for (const a of actions) {
            const btn = document.createElement('button')
            btn.type = 'button'
            btn.className = 'live-table-menu-btn' + (a.danger ? ' danger' : '')
            btn.title = a.label
            btn.setAttribute('aria-label', a.label)
            btn.innerHTML = ICONS[a.icon]
            btn.addEventListener('mousedown', (e) => e.preventDefault()) // 不抢编辑器焦点
            btn.addEventListener('click', a.run)
            bar.appendChild(btn)
          }
          document.body.appendChild(bar)

          const update = () => {
            const depth = tableDepth(editorView.state)
            if (depth < 1) {
              bar.style.display = 'none'
              return
            }
            const pos = editorView.state.selection.$from.before(depth)
            const dom = editorView.nodeDOM(pos) as HTMLElement | null
            if (!dom) {
              bar.style.display = 'none'
              return
            }
            const rect = dom.getBoundingClientRect()
            if (rect.width === 0) {
              bar.style.display = 'none'
              return
            }
            bar.style.display = 'flex'
            bar.style.left = `${Math.max(8, rect.left)}px`
            // 贴表格上沿;表格顶到容器顶时翻到表格下方
            const top = rect.top > 44 ? rect.top - 36 : rect.bottom + 6
            bar.style.top = `${top}px`
          }
          // 滚动(嵌套容器)与事务都重定位
          const onScroll = () => update()
          document.addEventListener('scroll', onScroll, true)
          update()
          return {
            update,
            destroy() {
              document.removeEventListener('scroll', onScroll, true)
              bar.remove()
            },
          }
        },
      }),
    ]
  },
})
