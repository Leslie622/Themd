import { BUILTIN_THEMES } from '@/lib/theme/builtin'
import type { ThemeFile } from '@/lib/theme/schema'
import type { ThemeTokens } from '@/lib/theme/tokens'

export interface ThemeSnapshot { schemaVersion: 1; themes: ThemeFile[]; activeId: string }
export interface ThemeRepository { load(): Promise<ThemeSnapshot | null>; save(snapshot: ThemeSnapshot): Promise<void> }
type Listener = () => void

/** 保存生命周期(仅内存,不进持久化快照):pending=防抖等待落库,saving=写库中 */
export type ThemeSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export class ThemeController {
  private state: ThemeSnapshot = { schemaVersion: 1, themes: [], activeId: 'default' }
  private readonly listeners = new Set<Listener>()
  private readonly statusListeners = new Set<Listener>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private saving = false
  private dirty = false
  private saveStatus: ThemeSaveStatus = 'idle'
  private readonly repository: ThemeRepository
  constructor(repository: ThemeRepository) { this.repository = repository }
  getSnapshot = () => this.state
  subscribe = (listener: Listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  getSaveStatus = () => this.saveStatus
  subscribeStatus = (listener: Listener) => { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener) }
  private setStatus(next: ThemeSaveStatus) { if (this.saveStatus === next) return; this.saveStatus = next; this.statusListeners.forEach((listener) => listener()) }

  private publish(next: ThemeSnapshot) { this.state = next; this.listeners.forEach((listener) => listener()); this.scheduleSave() }

  /** 200ms 防抖落库;状态经 subscribeStatus 供 UI 呈现「保存中…/已保存」,失败进 error 由 UI 重试(retrySave) */
  private scheduleSave() {
    this.dirty = true
    if (this.timer) clearTimeout(this.timer)
    this.setStatus('pending')
    this.timer = setTimeout(() => { this.timer = undefined; void this.flushSave() }, 200)
  }

  private async flushSave() {
    if (this.saving) return // 已有在途保存:它收尾时发现 dirty 会再排一轮,这里不丢数据
    this.saving = true
    this.dirty = false
    this.setStatus('saving')
    try {
      await this.repository.save(this.state)
      this.saving = false
      if (this.dirty) { this.scheduleSave(); return } // 保存期间又有改动
      this.setStatus('saved')
    } catch (error) {
      this.saving = false
      console.error('主题保存失败:', error)
      this.setStatus('error')
    }
  }

  /** UI 重试入口:立即再排一次落库 */
  retrySave = () => { this.scheduleSave() }

  async hydrate() { try { const saved = await this.repository.load(); if (saved) this.state = { ...saved, themes: saved.themes.filter((theme) => !theme.builtin) } } catch (error) { console.error('主题存储水合失败:', error) } this.listeners.forEach((listener) => listener()) }
  importSnapshot(snapshot: ThemeSnapshot) { this.publish({ ...snapshot, themes: snapshot.themes.filter((theme) => !theme.builtin) }) }
  upsertTheme(theme: ThemeFile) { this.publish({ ...this.state, themes: this.state.themes.some((t) => t.id === theme.id) ? this.state.themes.map((t) => t.id === theme.id ? theme : t) : [...this.state.themes, theme] }) }
  private source(id: string) { return BUILTIN_THEMES.find((t) => t.id === id) ?? this.state.themes.find((t) => t.id === id) }
  private copy(id: string, patch: Partial<ThemeFile> = {}): string { const source = this.source(id); if (!source) return id; const copy = { ...source, id: crypto.randomUUID(), name: `${source.name} 副本`, builtin: false, tokens: { ...source.tokens }, ...patch }; this.publish({ ...this.state, themes: [...this.state.themes, copy] }); return copy.id }
  updateTokens(id: string, tokens: ThemeTokens) { const source = this.source(id); if (source?.builtin) return this.copy(id, { tokens }); this.publish({ ...this.state, themes: this.state.themes.map((t) => t.id === id ? { ...t, tokens: { ...tokens } } : t) }); return id }
  updateTokensDark(id: string, tokens: ThemeTokens) { const source = this.source(id); if (source?.builtin) return this.copy(id, { dark: { ...tokens } }); this.publish({ ...this.state, themes: this.state.themes.map((t) => t.id === id ? { ...t, dark: { ...tokens } } : t) }); return id }
  setExtraCss(id: string, css: string) { const source = this.source(id); if (source?.builtin) return this.copy(id, { extraCss: css || undefined }); this.publish({ ...this.state, themes: this.state.themes.map((t) => t.id === id ? { ...t, extraCss: css || undefined } : t) }); return id }
  renameTheme(id: string, name: string) { this.publish({ ...this.state, themes: this.state.themes.map((t) => t.id === id ? { ...t, name } : t) }) }
  duplicateTheme(id: string) { return this.source(id) ? this.copy(id) : null }
  removeTheme(id: string) { this.publish({ ...this.state, themes: this.state.themes.filter((t) => t.id !== id), activeId: this.state.activeId === id ? 'default' : this.state.activeId }) }
  setActive(id: string) { this.publish({ ...this.state, activeId: id }) }
  importTheme(raw: string) { try { const data = JSON.parse(raw) as { name?: string; tokens?: ThemeTokens }; if (!data?.name) return null; const theme: ThemeFile = { version: 1, id: crypto.randomUUID(), name: data.name, tokens: data.tokens ?? {} }; this.publish({ ...this.state, themes: [...this.state.themes, theme] }); return theme.id } catch { return null } }
}
