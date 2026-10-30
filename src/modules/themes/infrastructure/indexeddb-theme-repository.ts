import type { ThemeRepository, ThemeSnapshot } from '../application/theme-controller'
const DB = 'themd-architecture'; const STORE = 'snapshots'; const KEY = 'themd/themes/v1'
export class IndexedDbThemeRepository implements ThemeRepository {
  private db?: Promise<IDBDatabase>
  private open() { if (!this.db) this.db = new Promise((resolve, reject) => { const request = indexedDB.open(DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }); return this.db }
  async load() { const db = await this.open(); return new Promise<ThemeSnapshot | null>((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).get(KEY); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error) }) }
  async save(snapshot: ThemeSnapshot) { const db = await this.open(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(snapshot, KEY); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }) }
}
