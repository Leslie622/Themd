import { BUILTIN_THEMES } from '@/lib/theme/builtin'
import type { ThemeFile } from '@/lib/theme/schema'
import type { ThemeTokens } from '@/lib/theme/tokens'

export interface ThemeSnapshot { schemaVersion: 1; themes: ThemeFile[]; activeId: string }
export interface ThemeRepository { load(): Promise<ThemeSnapshot | null>; save(snapshot: ThemeSnapshot): Promise<void> }
type Listener = () => void

export class ThemeController {
  private state: ThemeSnapshot = { schemaVersion: 1, themes: [], activeId: 'default' }
  private readonly listeners = new Set<Listener>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly repository: ThemeRepository
  constructor(repository: ThemeRepository) { this.repository = repository }
  getSnapshot = () => this.state
  subscribe = (listener: Listener) => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  private publish(next: ThemeSnapshot) { this.state = next; this.listeners.forEach((listener) => listener()); if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => void this.repository.save(this.state).catch((error: unknown) => console.error('主题保存失败:', error)), 200) }
  async hydrate() { try { const saved = await this.repository.load(); if (saved) this.state = { ...saved, themes: saved.themes.filter((theme) => !theme.builtin) } } catch (error) { console.error('主题存储水合失败:', error) } this.listeners.forEach((listener) => listener()) }
  importSnapshot(snapshot: ThemeSnapshot) { this.publish({ ...snapshot, themes: snapshot.themes.filter((theme) => !theme.builtin) }) }
  upsertTheme(theme: ThemeFile) { this.publish({ ...this.state, themes: this.state.themes.some((t) => t.id === theme.id) ? this.state.themes.map((t) => t.id === theme.id ? theme : t) : [...this.state.themes, theme] }) }
  private source(id: string) { return BUILTIN_THEMES.find((t) => t.id === id) ?? this.state.themes.find((t) => t.id === id) }
  private copy(id: string, patch: Partial<ThemeFile> = {}): string { const source = this.source(id); if (!source) return id; const copy = { ...source, ...patch, id: crypto.randomUUID(), name: `${source.name} 副本`, builtin: false, tokens: { ...source.tokens } }; this.publish({ ...this.state, themes: [...this.state.themes, copy], activeId: copy.id }); return copy.id }
  updateTokens(id: string, tokens: ThemeTokens) { const source = this.source(id); if (source?.builtin) return this.copy(id, { tokens }); this.publish({ ...this.state, themes: this.state.themes.map((t) => t.id === id ? { ...t, tokens: { ...tokens } } : t) }); return id }
  updateTokensDark(id: string, tokens: ThemeTokens) { const source = this.source(id); if (source?.builtin) return this.copy(id, { dark: { ...tokens } }); this.publish({ ...this.state, themes: this.state.themes.map((t) => t.id === id ? { ...t, dark: { ...tokens } } : t) }); return id }
  setExtraCss(id: string, css: string) { const source = this.source(id); if (source?.builtin) return this.copy(id, { extraCss: css || undefined }); this.publish({ ...this.state, themes: this.state.themes.map((t) => t.id === id ? { ...t, extraCss: css || undefined } : t) }); return id }
  renameTheme(id: string, name: string) { this.publish({ ...this.state, themes: this.state.themes.map((t) => t.id === id ? { ...t, name } : t) }) }
  duplicateTheme(id: string) { return this.source(id) ? this.copy(id) : null }
  removeTheme(id: string) { this.publish({ ...this.state, themes: this.state.themes.filter((t) => t.id !== id), activeId: this.state.activeId === id ? 'default' : this.state.activeId }) }
  setActive(id: string) { this.publish({ ...this.state, activeId: id }) }
  importTheme(raw: string) { try { const data = JSON.parse(raw) as { name?: string; tokens?: ThemeTokens }; if (!data?.name) return null; const theme: ThemeFile = { version: 1, id: crypto.randomUUID(), name: data.name, tokens: data.tokens ?? {} }; this.publish({ ...this.state, themes: [...this.state.themes, theme], activeId: theme.id }); return theme.id } catch { return null } }
}
