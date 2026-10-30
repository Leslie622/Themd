import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 工作区布局偏好。持久化 key `themd/ui-workspace/v1`。
 *
 * 侧栏是固定像素宽的普通 flex 区块,不参与 react-resizable-panels
 * 的百分比引擎(该引擎靠 JS 追赶校正,窗口缩放时会画脏帧导致内容抖动),
 * 拖拽由 SidebarResizeHandle 自绘,这里只负责记忆像素宽度。
 */

/** 侧栏默认/最小宽度。SIDEBAR_MIN 与主区可用下限共同约束可拖范围 */
export const SIDEBAR_DEFAULT_WIDTH = 288
export const SIDEBAR_MIN_WIDTH = 240
/** 上限:窗口最小宽 1024 - 主区可用下限 400 ≈ 620,取整留余量 */
export const SIDEBAR_MAX_WIDTH = 560

interface WorkspacePrefsState {
  /** 侧栏展开时的像素宽度（折叠状态不属于持久化事实，仍属 UI 会话） */
  sidebarWidth: number
  setSidebarWidth: (px: number) => void
}

export const useWorkspacePrefs = create<WorkspacePrefsState>()(
  persist(
    (set) => ({
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      setSidebarWidth: (px) => set({ sidebarWidth: px }),
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
