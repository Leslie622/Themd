import { NotebookController } from '@/modules/notebook/application/notebook-controller'
import { IndexedDbNoteRepository } from '@/modules/notebook/infrastructure/indexeddb-note-repository'
import { ThemeController } from '@/modules/themes/application/theme-controller'
import { IndexedDbThemeRepository } from '@/modules/themes/infrastructure/indexeddb-theme-repository'
import { createPlatformServices } from '@/platform/create-platform-services'
import { migrateNoteAssets } from '@/lib/note-assets'

export function createApplicationServices() {
  const platform = createPlatformServices()
  return {
    notebook: new NotebookController(new IndexedDbNoteRepository(), platform.fileLink, (content, fromDir, toDir) =>
      migrateNoteAssets(platform.files, content, fromDir, toDir),
    ),
    themes: new ThemeController(new IndexedDbThemeRepository()),
    platform,
  }
}

export const applicationServices = createApplicationServices()
