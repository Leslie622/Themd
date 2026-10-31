/**
 * 应用业务事件总线。`AppEventMap` 值为 payload 类型,void 表示无载荷。
 * 监听器签名按事件名自动匹配 payload;无载荷事件照旧 `() => ...` 使用。
 */
export type AppEventMap = {
  collapseSidebar: void
  openSettings: void
  insertImage: void
  /** 绑定文件在磁盘上被外部修改,而本地还有未写回的编辑,等 UI 弹冲突窗 */
  'fs-conflict': { noteId: string; path: string }
}
export type AppEventName = keyof AppEventMap

type PayloadOf<K extends AppEventName> = AppEventMap[K]
/** 无载荷事件传 [],有载荷事件传 [payload] */
type EmitArgs<K extends AppEventName> = PayloadOf<K> extends void ? [] : [PayloadOf<K>]

export class AppEventBus {
  private listeners = new Map<AppEventName, Set<(payload: unknown) => void>>()

  on<K extends AppEventName>(name: K, listener: (payload: PayloadOf<K>) => void): () => void {
    const list = this.listeners.get(name) ?? new Set()
    list.add(listener as (payload: unknown) => void)
    this.listeners.set(name, list)
    return () => { list.delete(listener as (payload: unknown) => void) }
  }

  emit<K extends AppEventName>(name: K, ...args: EmitArgs<K>): void {
    const payload = args[0] as unknown
    this.listeners.get(name)?.forEach((listener) => listener(payload))
  }
}

export const appEvents = new AppEventBus()
