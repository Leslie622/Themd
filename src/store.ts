import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { createIdbStorage } from '@/lib/storage'

export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
  /** 手动重命名后，标题不再自动跟随正文首行 */
  titleCustom?: boolean
  /** 本篇笔记专属主题 id（P5）；未设置 = 跟随全局激活主题 */
  themeId?: string
  /** 所属分组 id；未设置 = 未分组 */
    folderId?: string
}

export interface Folder {
  id: string
  name: string
  /** 展示排序 */
  order: number
}

interface NotebookState {
  notes: Note[]
  folders: Folder[]
  activeId: string | null
  /** persist 异步水合(IDB)完成前为 false,App 据此延迟渲染避免闪欢迎笔记 */
  hydrated: boolean
  createNote: (title?: string, content?: string) => string
  updateNote: (id: string, content: string) => void
  renameNote: (id: string, title: string) => void
  removeNote: (id: string) => void
  setActive: (id: string | null) => void
  /** 水合完成回调(onRehydrateStorage 用) */
  setHydrated: () => void
  /** 设置/清除本篇笔记的主题覆盖；清除后回落全局主题 */
  setNoteTheme: (id: string, themeId: string | null) => void
  /** 新建分组 */
  createFolder: (name: string) => string
  /** 分组重命名 */
  renameFolder: (id: string, name: string) => void
  /** 删除分组（组内笔记变为未分组） */
  removeFolder: (id: string) => void
  /** 删除分组并连同组内所有笔记一起删除 */
  removeFolderWithNotes: (id: string) => void
  /** 移动笔记到分组；folderId 为空 = 未分组 */
  setNoteFolder: (id: string, folderId: string | null) => void
}

/** 从正文推导标题：优先 # 标题，否则第一个非空行（跳过图片行） */
export function deriveTitle(content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)
  if (heading) return heading[1].trim().slice(0, 50)
  const line = content
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('!['))
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

### 插入图片

- **粘贴**：截图后直接 \`Ctrl+V\`，自动压缩成 WebP 内嵌进笔记
- **拖拽**：把图片文件拖进编辑器任意位置
- **按钮**：右上角「插入图片」可多选文件
- 笔记自包含：导出 \`.md\` 时图片一并带走

- [x] 支持任务列表
- [ ] 打开右上角菜单试试导出

---

**自定义渲染**：打开 \`src/lib/markdown.ts\`，里面的 \`renderer.rules\` 就是控制 HTML 输出的钩子。
`

export const useNotebook = create<NotebookState>()(
  persist(
    (set) => ({
      folders: [],
      notes: [
        {
          id: 'welcome-note',
          title: '欢迎使用 MD 笔记本',
          content: WELCOME,
          updatedAt: Date.now(),
        },
      ],
      activeId: 'welcome-note',
      hydrated: false,
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
      setHydrated: () => set({ hydrated: true }),
      setNoteTheme: (id, themeId) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  themeId: themeId ?? undefined,
                }
              : n,
          ),
        })),
      createFolder: (name) => {
        const id = crypto.randomUUID()
        set((s) => ({ folders: [...s.folders, { id, name, order: s.folders.length }] }))
        return id
      },
      renameFolder: (id, name) =>
        set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),
      removeFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          notes: s.notes.map((n) => (n.folderId === id ? { ...n, folderId: undefined } : n)),
        })),
      removeFolderWithNotes: (id) =>
        set((s) => {
          const notes = s.notes.filter((n) => n.folderId !== id)
          // 当前激活笔记在被删组里时,切到剩余第一条
          const removedActive =
            s.activeId != null && s.notes.some((n) => n.id === s.activeId && n.folderId === id)
          return {
            folders: s.folders.filter((f) => f.id !== id),
            notes,
            activeId: removedActive ? (notes[0]?.id ?? null) : s.activeId,
          }
        }),
      setNoteFolder: (id, folderId) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, folderId: folderId ?? undefined } : n)),
        })),
    }),
    {
      name: 'md-notebook',
      version: 3,
      // 存储升级 localStorage → IndexedDB:内嵌 base64 图片的笔记体积超出 LS 配额,
      // IDB 大几个数量级;适配器自带 LS→IDB 一次性迁移与写入防抖(见 lib/storage.ts)
      storage: createJSONStorage(() => createIdbStorage()),
      // hydrated 是运行时标志,不落盘
      partialize: (s) => ({
        notes: s.notes,
        folders: s.folders,
        activeId: s.activeId,
      }),
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as { notes?: Note[] } & Record<string, unknown>
        // v1 → v2:补 themeId 字段(默认 undefined = 跟随全局)
        if (version < 3) {
          state.folders = Array.isArray(state.folders) ? state.folders : []
        }
        if (version < 2 && Array.isArray(state.notes)) {
          state.notes = state.notes.map((n) => ({ ...n, themeId: n.themeId }))
        }
        return state as never
      },
      onRehydrateStorage: () => (state, error) => {
        // 水合失败(如 IDB 被禁)也要放行渲染,否则白屏
        state?.setHydrated?.()
        if (error) console.error('笔记存储水合失败:', error)
      },
    },
  ),
)
