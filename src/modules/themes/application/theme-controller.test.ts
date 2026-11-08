import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeController } from './theme-controller'
import type { ThemeRepository, ThemeSnapshot } from './theme-controller'

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

describe('ThemeController 保存生命周期(顶栏状态指示器的数据源)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  /** 逐次取用预设结果/错误的 save:push 一个消费一个,多余的调用会拿到 undefined 而失败 */
  const saveScript = (...results: (void | { fail: unknown })[]) => {
    let call = 0
    return vi.fn(() => {
      const result = results[Math.min(call, results.length - 1)]
      call += 1
      if (result && 'fail' in result) return Promise.reject(result.fail)
      return Promise.resolve()
    }) as unknown as ThemeRepository['save']
  }

  const watchStatus = (controller: ThemeController) => {
    const seen: string[] = []
    controller.subscribeStatus(() => seen.push(controller.getSaveStatus()))
    return seen
  }

  it('publish → pending →(防抖后)saving → saved,空闲时不产生保存', async () => {
    const save = saveScript()
    const controller = new ThemeController({ load: async () => null, save })
    const seen = watchStatus(controller)
    expect(controller.getSaveStatus()).toBe('idle')
    expect(save).not.toHaveBeenCalled()

    controller.upsertTheme({ version: 1, id: 'u1', name: '我的主题', tokens: {} })
    expect(controller.getSaveStatus()).toBe('pending')
    await vi.advanceTimersByTimeAsync(200)
    expect(save).toHaveBeenCalledTimes(1)
    expect(controller.getSaveStatus()).toBe('saved')
    expect(seen).toEqual(['pending', 'saving', 'saved'])
  })

  it('保存失败进 error,retrySave 重排落库成功后回 saved', async () => {
    // 第一轮失败,重试那轮成功(脚本逐次取用,末位兜底)
    const save = saveScript({ fail: new Error('boom') }, undefined)
    const controller = new ThemeController({ load: async () => null, save })
    controller.upsertTheme({ version: 1, id: 'u1', name: '我的主题', tokens: {} })
    await vi.advanceTimersByTimeAsync(200)
    expect(controller.getSaveStatus()).toBe('error')

    controller.retrySave()
    expect(controller.getSaveStatus()).toBe('pending')
    await vi.advanceTimersByTimeAsync(200)
    expect(save).toHaveBeenCalledTimes(2)
    expect(controller.getSaveStatus()).toBe('saved')
  })

  it('保存期间又有改动:第一轮完成后自动再排一轮,最终落库的是最新快照', async () => {
    // 第一轮 save 挂起直到放行,模拟在途写库
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const save = vi.fn()
    save.mockImplementationOnce(() => gate)
    save.mockImplementationOnce(() => Promise.resolve())
    const controller = new ThemeController({
      load: async () => null,
      save: save as unknown as ThemeRepository['save'],
    })

    controller.upsertTheme({ version: 1, id: 'u1', name: '第一次改动', tokens: {} })
    await vi.advanceTimersByTimeAsync(200)
    expect(controller.getSaveStatus()).toBe('saving')

    // 在途期间再次 publish:状态回 pending、dirty 记账
    controller.renameTheme('u1', '第二次改动')
    expect(controller.getSaveStatus()).toBe('pending')

    release()
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    // 第一轮收尾发现 dirty → 自动重排;此刻只发生过一次落库,状态停在 pending
    expect(save).toHaveBeenCalledTimes(1)
    expect(controller.getSaveStatus()).toBe('pending')
    await vi.advanceTimersByTimeAsync(200)
    expect(save).toHaveBeenCalledTimes(2)
    expect(controller.getSaveStatus()).toBe('saved')
    const saved = (save.mock.calls[1] as unknown as [ThemeSnapshot])[0]
    expect(saved.themes[0]?.name).toBe('第二次改动')
  })
})
