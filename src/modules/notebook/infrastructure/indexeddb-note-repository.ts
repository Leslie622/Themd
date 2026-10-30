import type { NoteRepository } from '../application/notebook-controller'
import type { NotebookSnapshot } from '../domain/note'

const DB_NAME = 'themd-architecture'
const STORE_NAME = 'snapshots'
const KEY = 'themd/notebook/v1'

export class IndexedDbNoteRepository implements NoteRepository {
  private dbPromise: Promise<IDBDatabase> | undefined
  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return this.dbPromise
  }
  async load(): Promise<NotebookSnapshot | null> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(KEY)
      request.onsuccess = () => resolve((request.result as NotebookSnapshot | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  }
  async save(snapshot: NotebookSnapshot): Promise<void> {
    const db = await this.open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(snapshot, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}
