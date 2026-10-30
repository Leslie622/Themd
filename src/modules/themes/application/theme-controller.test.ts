import { describe, expect, it } from 'vitest'
import { ThemeController } from './theme-controller'

describe('ThemeController', () => {
  it('copies a built-in theme before editing it', () => {
    const controller = new ThemeController({ load: async () => null, save: async () => {} })
    const id = controller.updateTokens('default', { 'root.color': '#123456' })
    expect(id).not.toBe('default')
    expect(controller.getSnapshot().themes).toHaveLength(1)
    expect(controller.getSnapshot().activeId).toBe(id)
  })
})
