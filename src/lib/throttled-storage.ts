/**
 * localStorage 的节流包装（供 zustand persist 的 createJSONStorage 使用）。
 * localStorage.setItem 是同步 IO，取色器拖动、编辑器打字这类高频 set
 * 会逐次全量落盘造成卡顿；这里合并为最多每 WRITE_DELAY 一次写入，
 * 页面隐藏/关闭前强制 flush，不丢数据。
 *
 * 注意:zustand v5 persist 的 storage 收发的 value 是对象 {state,version}（JSON 序列化
 * 由 createJSONStorage 负责），本文件只做字符串层的节流，必须与 createJSONStorage 搭配：
 *   storage: createJSONStorage(() => throttledStateStorage)
 */
const WRITE_DELAY = 250

const pending = new Map<string, string>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function flushWriteOne(name: string) {
  const value = pending.get(name)
  if (value === undefined) return
  pending.delete(name)
  try {
    localStorage.setItem(name, value)
  } catch {
    // 配额满等异常与直写 localStorage 的失败行为一致，不中断应用
  }
}

export function flushThrottledWrites() {
  for (const name of [...pending.keys()]) {
    const t = timers.get(name)
    if (t) {
      clearTimeout(t)
      timers.delete(name)
    }
    flushWriteOne(name)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushThrottledWrites)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushThrottledWrites()
  })
}

/** StateStorage 形态（字符串进出），供 createJSONStorage 消费 */
export const throttledStateStorage = {
  getItem: (name: string): string | null => {
    const p = pending.get(name)
    return p !== undefined ? p : localStorage.getItem(name)
  },
  setItem: (name: string, value: string): void => {
    pending.set(name, value)
    if (!timers.has(name)) {
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name)
          flushWriteOne(name)
        }, WRITE_DELAY),
      )
    }
  },
  removeItem: (name: string): void => {
    pending.delete(name)
    const t = timers.get(name)
    if (t) {
      clearTimeout(t)
      timers.delete(name)
    }
    localStorage.removeItem(name)
  },
}
