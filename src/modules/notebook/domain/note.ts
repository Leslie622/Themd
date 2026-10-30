export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
  titleCustom?: boolean
  themeId?: string
  folderId?: string
}

export interface Folder {
  id: string
  name: string
  order: number
}

export interface NotebookSnapshot {
  schemaVersion: 1
  notes: Note[]
  folders: Folder[]
}

export function deriveTitle(content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)
  if (heading) return heading[1].trim().slice(0, 50)
  const line = content
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith('#') && !item.startsWith('!['))
  return line ? line.replace(/^[#>*`\-\s]+/, '').slice(0, 50) : ''
}

export const NOTEBOOK_SCHEMA_VERSION = 1 as const
