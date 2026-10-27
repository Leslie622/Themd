import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
  /** 手动重命名后，标题不再自动跟随正文首行 */
  titleCustom?: boolean
}

interface NotebookState {
  notes: Note[]
  activeId: string | null
  createNote: (title?: string, content?: string) => string
  updateNote: (id: string, content: string) => void
  renameNote: (id: string, title: string) => void
  removeNote: (id: string) => void
  setActive: (id: string | null) => void
}

/** 从正文推导标题：优先 # 标题，否则第一个非空行 */
export function deriveTitle(content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)
  if (heading) return heading[1].trim().slice(0, 50)
  const line = content
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'))
  if (!line) return ''
  return line.replace(/^[#>*`\-\s]+/, '').slice(0, 50)
}

const WELCOME = `# 欢迎使用 MD 笔记本 👋

## 快速上手

- **新建**：点击左上角「新建」按钮
- **导入**：点击「导入」可选择本地 \`.md\` 文件（支持多选）
- **三种视图**：顶部切换 编辑 / 分屏 / 预览，分屏中间的分割线可以拖动
- **自动保存**：所有修改实时存到浏览器本地，刷新不丢
- **导出**：右上角菜单可导出当前笔记为 \`.md\`

## 支持的语法

### 代码高亮

\`\`\`ts
const hello = (name: string) => \`Hello, \${name}!\`
hello('Markdown')
\`\`\`

### 表格

| 功能 | 状态 |
| ---- | ---- |
| 实时预览 | ✅ |
| 代码高亮 | ✅ |
| 数学公式 | 🔜 |

> 引用、任务列表、链接自动识别（linkify）都开箱即用~

- [x] 支持任务列表
- [ ] 打开右上角菜单试试导出

---

**自定义渲染**：打开 \`src/lib/markdown.ts\`，里面的 \`renderer.rules\` 就是控制 HTML 输出的钩子。
`

export const useNotebook = create<NotebookState>()(
  persist(
    (set) => ({
      notes: [
        {
          id: 'welcome-note',
          title: '欢迎使用 MD 笔记本',
          content: WELCOME,
          updatedAt: Date.now(),
        },
      ],
      activeId: 'welcome-note',
      createNote: (title, content = '') => {
        const id = crypto.randomUUID()
        const note: Note = {
          id,
          title: title || deriveTitle(content) || '新笔记',
          content,
          updatedAt: Date.now(),
        }
        set((s) => ({ notes: [note, ...s.notes], activeId: id }))
        return id
      },
      updateNote: (id, content) =>
        set((s) => ({
          notes: s.notes.map((n): Note => {
            if (n.id !== id) return n
            const derived = deriveTitle(content)
            return {
              ...n,
              content,
              updatedAt: Date.now(),
              title: !n.titleCustom && derived ? derived : n.title,
            }
          }),
        })),
      renameNote: (id, title) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id ? { ...n, title: title || n.title, titleCustom: true } : n,
          ),
        })),
      removeNote: (id) =>
        set((s) => {
          const notes = s.notes.filter((n) => n.id !== id)
          const activeId = s.activeId === id ? (notes[0]?.id ?? null) : s.activeId
          return { notes, activeId }
        }),
      setActive: (id) => set({ activeId: id }),
    }),
    { name: 'md-notebook', version: 1 },
  ),
)
