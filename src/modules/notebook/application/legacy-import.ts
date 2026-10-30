import type { NotebookController } from './notebook-controller'
import type { Note, Folder } from '../domain/note'

export interface LegacyImportResult { imported: boolean; notes: number; folders: number }

/** Reads the old key only when explicitly invoked by a recovery/import UI. */
export function importLegacyNotebook(controller: NotebookController, storage: Storage = localStorage): LegacyImportResult {
  const raw = storage.getItem('md-notebook')
  if (!raw) return { imported: false, notes: 0, folders: 0 }
  try {
    const parsed = JSON.parse(raw) as { state?: { notes?: Note[]; folders?: Folder[] } }
    const notes = parsed.state?.notes ?? []
    const folders = parsed.state?.folders ?? []
    controller.importSnapshot({ schemaVersion: 1, notes, folders })
    return { imported: true, notes: notes.length, folders: folders.length }
  } catch {
    return { imported: false, notes: 0, folders: 0 }
  }
}
