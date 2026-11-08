import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { exportNoteHtml, exportNoteMarkdown } from './export-note'
import { platformServices } from '@/app/platform'
import type { Note } from '@/modules/notebook/domain/note'
import type { EditorViewMode } from '@/store-editor'

/** 视图模式与 AppShell/store-editor 同源,不在本模块重抄一份 */
export type ExportViewMode = EditorViewMode

interface ExportActionsInput {
  active: Note | null
  view: ExportViewMode
  setView: (view: ExportViewMode) => void
}

export function useExportActions({ active, view, setView }: ExportActionsInput) {
  const printPrevView = useRef<ExportViewMode | null>(null)
  const pendingExport = useRef<string | null>(null)

  const restoreView = useCallback(() => {
    const previous = printPrevView.current
    printPrevView.current = null
    if (previous && previous !== 'preview') setView(previous)
  }, [setView])

  const runPendingExport = useCallback(() => {
    const pending = pendingExport.current
    if (!pending) return
    pendingExport.current = null
    void platformServices.pdf.exportToPath(pending)
      .then(() => toast.success(`已保存到 ${pending}`))
      .catch((error: unknown) => toast.error(`PDF 导出失败: ${String(error)}`))
      .finally(restoreView)
  }, [restoreView])

  useEffect(() => {
    runPendingExport()
  }, [runPendingExport, view])

  const exportPdf = useCallback(async () => {
    // 无活动笔记先于状态记忆返回:printPrevView 只在真正要打印时记,
    // 否则残留旧引用会让下次打印完成后 restoreView 切到错视图
    if (!active) return
    printPrevView.current = view
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
      toast.success(`已保存到 ${result.path}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败')
    }
  }, [active])

  return { exportPdf, exportNoteFile }
}
