import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'

import { downloadNote } from '@/lib/files'
import { downloadNoteHtml } from '@/modules/rendering/standalone-html'
import { exportNoteHtml, exportNoteMarkdown } from './export-note'
import { platformServices } from '@/app/platform'
import type { Note } from '@/modules/notebook/domain/note'

export type ExportViewMode = 'edit' | 'split' | 'preview'

interface ExportActionsInput {
  active: Note | null
  view: ExportViewMode
  setView: Dispatch<SetStateAction<ExportViewMode>>
}

export function useExportActions({ active, view, setView }: ExportActionsInput) {
  const printPrevView = useRef<ExportViewMode | null>(null)
  const pendingExport = useRef<null | 'print' | string>(null)

  const restoreView = useCallback(() => {
    const previous = printPrevView.current
    printPrevView.current = null
    if (previous && previous !== 'preview') setView(previous)
  }, [setView])

  const runPendingExport = useCallback(() => {
    const pending = pendingExport.current
    if (!pending) return
    pendingExport.current = null
    if (pending === 'print') {
      platformServices.pdf.print()
      return
    }
    void platformServices.pdf.exportToPath(pending)
      .then(() => toast.success(`已保存到 ${pending}`))
      .catch((error: unknown) => toast.error(`PDF 导出失败: ${String(error)}`))
      .finally(restoreView)
  }, [restoreView])

  useEffect(() => {
    const onAfterPrint = () => restoreView()
    return platformServices.pdf.onAfterPrint(onAfterPrint)
  }, [restoreView])

  useEffect(() => {
    runPendingExport()
  }, [runPendingExport, view])

  const exportPdf = useCallback(async () => {
    printPrevView.current = view
    if (platformServices.isDesktop) {
      if (!active) return
      const path = await platformServices.files.chooseSavePath({
        defaultName: `${active.title || 'note'}.pdf`,
        filterName: 'PDF',
        extensions: ['pdf'],
      })
      if (!path) {
        printPrevView.current = null
        return
      }
      pendingExport.current = path
    } else {
      pendingExport.current = 'print'
    }
    if (view === 'preview') runPendingExport()
    else setView('preview')
  }, [active, runPendingExport, setView, view])

  const exportNoteFile = useCallback(async (kind: 'md' | 'html') => {
    if (!active) return
    try {
      const result = kind === 'md'
        ? await exportNoteMarkdown(platformServices.files, active)
        : await exportNoteHtml(platformServices.files, active)
      if (result.kind === 'canceled') return
      if (result.kind === 'web') {
        if (kind === 'md') downloadNote(active)
        else downloadNoteHtml(active)
        toast.success(`已导出「${active.title}」.${kind}`)
      } else {
        toast.success(`已保存到 ${result.path}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    }
  }, [active])

  return { exportPdf, exportNoteFile }
}
