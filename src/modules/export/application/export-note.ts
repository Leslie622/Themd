import type { FileGateway } from '@/platform/contracts'
import type { Note } from '@/modules/notebook/domain/note'
import { renderStandaloneHtml } from '@/modules/rendering/standalone-html'

export async function exportNoteMarkdown(files: FileGateway, note: Note) { return files.saveText({ defaultName: `${note.title || 'note'}.md`, contents: note.content, filterName: 'Markdown 文档', extensions: ['md'] }) }
export async function exportNoteHtml(files: FileGateway, note: Note) { return files.saveText({ defaultName: `${note.title || 'note'}.html`, contents: renderStandaloneHtml(note), filterName: 'HTML 文档', extensions: ['html'] }) }
