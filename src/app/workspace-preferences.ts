import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 工作区布局与目录偏好。持久化 key `themd/ui-workspace/v1`。
 *
 * 侧栏是固定像素宽的普通 flex 区块,不参与 react-resizable-panels
 * 的百分比引擎(该引擎靠 JS 追赶校正,窗口缩放时会画脏帧导致内容抖动),
 * 拖拽由 SidebarResizeHandle 自绘,这里只负责记忆像素宽度。
 *
 * 工作区目录(current/recents)是机器本地事实:controller 的笔记快照
 * 只做缓存,重启后由 UI 读 current 重新 openWorkspace 从磁盘重建。
 */

/** 侧栏默认/最小宽度。SIDEBAR_MIN 与主区可用下限共同约束可拖范围 */
export const SIDEBAR_DEFAULT_WIDTH = 288
export const SIDEBAR_MIN_WIDTH = 240
/** 上限:窗口最小宽 1024 - 主区可用下限 400 ≈ 620,取整留余量 */
export const SIDEBAR_MAX_WIDTH = 560

/** 最近工作区列表长度上限(旧的自动挤出) */
const RECENTS_MAX = 5

interface WorkspacePrefsState {
  /** 侧栏展开时的像素宽度（折叠状态不属于持久化事实，仍属 UI 会话） */
  sidebarWidth: number
  /** 上次打开的工作区根目录;空 = 未打开过(或已清除) */
  current: string
  /** 最近工作区列表(新→旧,去重,不含 current 之外的重复) */
  recents: string[]
  setSidebarWidth: (px: number) => void
  /** 记住刚打开的工作区:置顶 current 并挤入 recents */
  rememberWorkspace: (root: string) => void
  /** 清除工作区记忆(关闭工作区时) */
  forgetWorkspace: () => void
}

export const useWorkspacePrefs = create<WorkspacePrefsState>()(
  persist(
    (set) => ({
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      current: '',
      recents: [],
      setSidebarWidth: (px) => set({ sidebarWidth: px }),
      rememberWorkspace: (root) =>
        set((s) => ({
          current: root,
          recents: [root, ...s.recents.filter((r) => r !== root)].slice(0, RECENTS_MAX),
        })),
      forgetWorkspace: () => set({ current: '' }),
    }),
    {
      name: 'themd/ui-workspace/v1',
      version: 1,
    },
  ),
)

/** 手势结束时的落库值：夹取到合法范围 */
export function clampSidebarWidth(px: number): number {
  return Math.min(Math.max(Math.round(px), SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH)
}
