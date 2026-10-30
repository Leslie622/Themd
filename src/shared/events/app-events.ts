export type AppEventMap = { collapseSidebar: void; openSettings: void; insertImage: void }
export type AppEventName = keyof AppEventMap

export class AppEventBus {
  private listeners = new Map<AppEventName, Set<() => void>>()
  on(name: AppEventName, listener: () => void) { const list = this.listeners.get(name) ?? new Set(); list.add(listener); this.listeners.set(name, list); return () => { list.delete(listener) } }
  emit(name: AppEventName) { this.listeners.get(name)?.forEach((listener) => listener()) }
}

export const appEvents = new AppEventBus()
