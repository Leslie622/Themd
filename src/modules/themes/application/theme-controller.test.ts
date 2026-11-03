import { describe, expect, it } from 'vitest'
import { ThemeController } from './theme-controller'

describe('ThemeController', () => {
  it('copies a built-in theme before editing it, without stealing the active slot', () => {
    const controller = new ThemeController({ load: async () => null, save: async () => {} })
    const id = controller.updateTokens('default', { 'root.color': '#123456' })
    expect(id).not.toBe('default')
    expect(controller.getSnapshot().themes).toHaveLength(1)
    // 「使用中」只能经显式 setActive 改变:复制(含内置编辑自动复制/创建副本/导入)一律不抢激活
    expect(controller.getSnapshot().activeId).toBe('default')
    expect(controller.duplicateTheme(id)).not.toBe(id)
    expect(controller.getSnapshot().activeId).toBe('default')
    expect(controller.getSnapshot().themes).toHaveLength(2)
  })
})
