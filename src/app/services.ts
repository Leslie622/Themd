import { NotebookController } from '@/modules/notebook/application/notebook-controller'
import { IndexedDbNoteRepository } from '@/modules/notebook/infrastructure/indexeddb-note-repository'
import { ThemeController } from '@/modules/themes/application/theme-controller'
import { IndexedDbThemeRepository } from '@/modules/themes/infrastructure/indexeddb-theme-repository'
import { createPlatformServices } from '@/platform/create-platform-services'

export function createApplicationServices() {
  return {
    notebook: new NotebookController(new IndexedDbNoteRepository()),
    themes: new ThemeController(new IndexedDbThemeRepository()),
    platform: createPlatformServices(),
  }
}

export const applicationServices = createApplicationServices()
