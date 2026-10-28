import type { StateStorage } from 'zustand/middleware'

/**
 * zustand persist 的 IndexedDB 适配器(零依赖,单 kv store)。
 * localStorage 约 5MB 配额装不下内嵌 base64 图片的笔记,IDB 配额大几个数量级;
 * 另加 300ms 尾沿防抖——persist 在每次 set 时全量序列化,大笔记逐键写入会卡。
 */

const DB_NAME = 'themd'
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME)
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode)
        const req = fn(tx.objectStore(STORE_NAME))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

/** 一次性迁移:老用户的笔记在 localStorage,搬进 IDB 后清除 LS 键 */
async function migrateFromLocalStorage(key: string): Promise<void> {
  try {
    const legacy = localStorage.getItem(key)
    if (!legacy) return
    const existing = await withStore<string | undefined>('readonly', (s) => s.get(key))
    if (existing == null) {
      await withStore('readwrite', (s) => s.put(legacy, key))
    }
    localStorage.removeItem(key)
  } catch {
    // 迁移失败不阻塞启动:LS 里的数据仍在,下次再试
  }
}

/** 每个持久化 key 独立防抖计时器 */
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const pending = new Map<string, string>()

/** 立即冲刷未落盘的防抖写入:打完字立刻关窗口也不能丢数据 */
function flushPending(): void {
  for (const [name, value] of pending) {
    pending.delete(name)
    const t = timers.get(name)
    if (t) {
      clearTimeout(t)
      timers.delete(name)
    }
    void withStore('readwrite', (s) => s.put(value, name)).catch(() => {})
  }
}

// 页面进后台/关闭时冲刷(桌面端关窗、切走都会触发)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending()
  })
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPending)
}

export function createIdbStorage(debounceMs = 300): StateStorage {
  return {
    async getItem(name) {
      await migrateFromLocalStorage(name)
      return (await withStore<string | undefined>('readonly', (s) => s.get(name))) ?? null
    },
    async setItem(name, value) {
      pending.set(name, value)
      const t = timers.get(name)
      if (t) clearTimeout(t)
      timers.set(
        name,
        setTimeout(() => {
          const v = pending.get(name)
          if (v == null) return
          pending.delete(name)
          timers.delete(name)
          void withStore('readwrite', (s) => s.put(v, name)).catch(() => {})
        }, debounceMs),
      )
    },
    async removeItem(name) {
      const t = timers.get(name)
      if (t) {
        clearTimeout(t)
        timers.delete(name)
        pending.delete(name)
      }
      await withStore('readwrite', (s) => s.delete(name))
    },
  }
}
