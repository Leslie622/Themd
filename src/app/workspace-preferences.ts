import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 工作区布局偏好。持久化 key `themd/ui-workspace/v1`。
 *
 * 侧栏宽度按「像素」记忆，不随应用窗口整体缩放：
 * react-resizable-panels v4 自带的 defaultLayout 记忆的是百分比，
 * 恢复后仍随窗口缩放，与需求相悖，因此这里只持久化像素值；
 * 窗口缩放期间的保持交给 Panel 的 groupResizeBehavior="preserve-pixel-size"。
 */

/** 侧栏默认/最小宽度。minSize 与主区 minSize=400 共同约束可拖范围 */
export const SIDEBAR_DEFAULT_WIDTH = 288
export const SIDEBAR_MIN_WIDTH = 240

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
  return Math.min(Math.max(Math.round(px), SIDEBAR_MIN_WIDTH), 560)
}
