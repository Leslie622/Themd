import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ThemeStudio } from '@/components/theme/ThemeStudio'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { notebookController, useNotebook } from '@/store'
import { platformServices } from '@/app/platform'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useSyncScroll } from '@/lib/scroll-sync'
import { setActiveNoteDir } from '@/lib/image-src'
import { appEvents } from '@/shared/events/app-events'
import { AppShell, type ViewMode } from '@/app/AppShell'
import { clampSidebarWidth, useWorkspacePrefs } from '@/app/workspace-preferences'
import { useExportActions } from '@/modules/export/application/use-export-actions'

export default function App() {
  const hydrated = useNotebook((state) => state.hydrated)
  const notes = useNotebook((state) => state.notes)
  const activeId = useNotebook((state) => state.activeId)
  const updateNote = useNotebook((state) => state.updateNote)
  const createNote = useNotebook((state) => state.createNote)
  const removeNote = useNotebook((state) => state.removeNote)
  const setNoteTheme = useNotebook((state) => state.setNoteTheme)
  const activeFileMissing = useNotebook((state) =>
    state.activeId ? state.fileMissingIds.has(state.activeId) : false,
  )
  const themeList = useThemeStore((state) => state.themes)
  const themeActiveId = useThemeStore((state) => state.activeId)
  const active = notes.find((note) => note.id === activeId) ?? null
  const allThemes = useMemo(() => listAllThemes({ themes: themeList, activeId: themeActiveId }), [themeList, themeActiveId])
  const globalThemeName = useMemo(() => resolveActiveTheme({ themes: themeList, activeId: themeActiveId }).name, [themeList, themeActiveId])
  const noteThemeLabel = active
    ? active.themeId
      ? `笔记主题:仅此笔记(${allThemes.find((theme) => theme.id === active.themeId)?.name ?? '主题已删除'})`
      : `笔记主题:跟随全局(当前:${globalThemeName})`
    : '笔记主题'

  const [view, setView] = useState<ViewMode>('split')
  const { bindEditorScroller, bindPreviewScroller } = useSyncScroll()
  const [studioOpen, setStudioOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [conflict, setConflict] = useState<{ noteId: string } | null>(null)
  /** 另存为成功后仍留在原位置的原文件(弹确认框让用户决定删不删) */
  const [staleOriginal, setStaleOriginal] = useState<{ path: string } | null>(null)
  /** 库内笔记首编弹保存框被取消后,打字流本次会话不再追问 */
  const bindPromptSuppressed = useRef(false)
  /** 保存框重入锁:对话框未关闭期间,后续击键/Ctrl+S 不再叠加新对话框 */
  const bindPromptInFlight = useRef(false)
  const sidebarWidth = useWorkspacePrefs((state) => state.sidebarWidth)
  const setSidebarWidth = useWorkspacePrefs((state) => state.setSidebarWidth)
  const { exportPdf, exportNoteFile } = useExportActions({ active, view, setView })

  useEffect(() => {
    const offCollapse = appEvents.on('collapseSidebar', () => setSidebarCollapsed(true))
    const offSettings = appEvents.on('openSettings', () => setSettingsOpen(true))
    const offConflict = appEvents.on('fs-conflict', ({ noteId }) => setConflict({ noteId }))
    // 写回失败必须可见:本地未写回编辑只活在内存里,静默失败 = 用户以为已保存
    const offWriteFailed = appEvents.on('write-failed', ({ noteId, path, error }) => {
      toast.error(`写回失败(文件可能被占用或权限不足): ${error}`, {
        description: path,
        duration: 8000,
        action: {
          label: '重试',
          onClick: () => notebookController.flushNote(noteId),
        },
      })
    })
    return () => {
      offCollapse()
      offSettings()
      offConflict()
      offWriteFailed()
    }
  }, [])

  // 活动笔记变化:图片相对路径的解析基准切到笔记自身目录(绑定笔记,Typora 语义)
  useEffect(() => {
    setActiveNoteDir(active?.sourcePath)
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps -- 目录只取决于绑定路径,切笔记时更新即可

  /**
   * 未绑定笔记选路径并绑定落盘。respectSuppression 区分两种入口:
   * - 打字流(true):用户取消过一次就不再追问,本次会话保持库内模式
   * - Ctrl+S(false):显式保存指令,永远允许弹框(Typora 行为),取消则静默
   * in-flight 锁防重入:对话框打开期间后续击键不会叠加出更多对话框。
   */
  const promptBindIfNeeded = useCallback(async (id: string, respectSuppression: boolean): Promise<void> => {
    if (!platformServices.isDesktop || bindPromptInFlight.current) return
    if (respectSuppression && bindPromptSuppressed.current) return
    const note = notebookController.getSnapshot().notes.find((n) => n.id === id)
    if (!note || note.sourcePath) return
    bindPromptInFlight.current = true
    try {
      const path = await platformServices.files.chooseSavePath({
        defaultName: `${note.title || '新笔记'}.md`,
        filterName: 'Markdown 文档',
        extensions: ['md', 'markdown', 'txt'],
      })
      if (path) {
        // 图片随迁统一在 bindNoteToFile 内(首绑从全局图片根迁入笔记目录)
        await notebookController.bindNoteToFile(id, path)
      } else {
        bindPromptSuppressed.current = true
      }
    } catch (error: unknown) {
      console.error('绑定文件失败:', error)
      toast.error(`绑定文件失败: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      bindPromptInFlight.current = false
    }
  }, [])

  /**
   * 主动另存为:当前内容写到所选新位置并(重新)绑定,assets 图片随迁。
   * 三种场景同一动作——未绑定笔记=选位置绑定文件;已绑定=迁到新位置重新绑定;
   * 失联笔记=自救重新落盘。入口:导出菜单项与 Ctrl+Shift+S。
   */
  const handleNoteSaveAs = useCallback(async () => {
    const { activeId, notes: current, fileMissingIds } = notebookController.getSnapshot()
    if (!activeId) return
    const note = current.find((n) => n.id === activeId)
    if (!note) return
    const path = await platformServices.files.chooseSavePath({
      defaultName: `${note.title || '新笔记'}.md`,
      filterName: 'Markdown 文档',
      extensions: ['md', 'markdown', 'txt'],
    })
    if (!path) return
    // 另存为是复制语义:原文件保留,成功后弹确认让用户决定是否删掉(=移动)。
    // 失联笔记原文件已不在磁盘上,无需询问。
    const previousPath = note.sourcePath
    const wasMissing = fileMissingIds.has(activeId)
    try {
      // 图片随迁统一在 bindNoteToFile 内(老目录 → 新目录)
      await notebookController.bindNoteToFile(activeId, path)
      toast.success(`已另存并重新绑定: ${path}`)
      if (previousPath && previousPath !== path && !wasMissing) setStaleOriginal({ path: previousPath })
    } catch (error: unknown) {
      console.error('另存失败:', error)
      toast.error(`另存失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [])

  /** Ctrl+S:绑定笔记立即写回;未绑定笔记弹保存框绑定落盘 */
  const saveActiveNote = useCallback(() => {
    const { activeId, notes: current } = notebookController.getSnapshot()
    if (!activeId) return
    const note = current.find((n) => n.id === activeId)
    if (!note) return
    if (note.sourcePath) {
      notebookController.flushNote(activeId)
      return
    }
    void promptBindIfNeeded(activeId, false)
  }, [promptBindIfNeeded])

  // 文件绑定双向同步的落盘时机:Ctrl+S 显式保存;Ctrl+Shift+S 另存为;
  // 失焦/切后台/托盘退出前冲刷
  useEffect(() => {
    const flush = () => notebookController.flushAll()
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (event.shiftKey) {
          void handleNoteSaveAs()
        } else {
          saveActiveNote()
        }
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', flush)
    document.addEventListener('visibilitychange', onVisibility)
    let offQuit: (() => void) | null = null
    if (platformServices.isDesktop) {
      void import('@tauri-apps/api/event').then(({ listen }) =>
        listen('app-before-quit', flush).then((unlisten) => { offQuit = unlisten }),
      )
    }
    return () => {
      flush()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      offQuit?.()
    }
  }, [handleNoteSaveAs, saveActiveNote])

  /**
   * 编辑入口:库内笔记(无 sourcePath)在桌面端首次编辑时弹原生保存框选位置,
   * 选中即绑定文件(内容写盘,此后双向同步);取消则打字流本次会话不再追问,
   * 笔记保持库内模式。Web 端无本地写能力,始终库内模式。
   */
  const handleEditorChange = async (id: string, content: string) => {
    const target = notes.find((note) => note.id === id)
    if (target && !target.sourcePath) await promptBindIfNeeded(id, true)
    updateNote(id, content)
  }

  const handleEditorChangeSync = (id: string, content: string) => {
    void handleEditorChange(id, content)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewText(active?.content ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    const timer = setTimeout(() => setPreviewText(active?.content ?? ''), 150)
    return () => clearTimeout(timer)
  }, [active?.content])

  if (studioOpen) {
    return <div className="flex h-full w-full"><ThemeStudio onBack={() => setStudioOpen(false)} /></div>
  }

  if (!hydrated) return null

  return (
    <AppShell
      active={active}
      allThemes={allThemes}
      noteThemeLabel={noteThemeLabel}
      view={view}
      setView={setView}
      previewText={previewText}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarExpand={() => setSidebarCollapsed(false)}
      sidebarWidth={clampSidebarWidth(sidebarWidth)}
      onSidebarWidthCommit={setSidebarWidth}
      settingsOpen={settingsOpen}
      setSettingsOpen={setSettingsOpen}
      setStudioOpen={setStudioOpen}
      updateNote={handleEditorChangeSync}
      createNote={() => createNote()}
      setNoteTheme={setNoteTheme}
      exportPdf={exportPdf}
      exportNoteFile={exportNoteFile}
      fileMissing={activeFileMissing}
      onNoteSaveAs={() => void handleNoteSaveAs()}
      onNoteDelete={() => {
          if (activeId)
            void removeNote(activeId).catch((error: unknown) => console.error('删除笔记失败:', error))
        }}
      bindEditorScroller={bindEditorScroller}
      bindPreviewScroller={bindPreviewScroller}
    >
      {/* 文件绑定冲突:外部改了文件、本地还有未写回的编辑,二选一 */}
      <Dialog open={conflict !== null} onOpenChange={(open) => { if (!open) setConflict(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>文件已被外部修改</DialogTitle>
            <DialogDescription>
              绑定的文件在磁盘上被其他程序修改了,而当前还有未写回的本地编辑。保留哪一边?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (conflict) void notebookController.reloadNoteFromDisk(conflict.noteId)
                setConflict(null)
              }}
            >
              重新加载文件
            </Button>
            <Button
              onClick={() => {
                if (conflict) notebookController.keepLocalNote(conflict.noteId)
                setConflict(null)
              }}
            >
              保留我的版本
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* 另存为后的原文件清理:另存为是复制语义,默认保留,用户确认后可删(=移动) */}
      <AlertDialog open={staleOriginal !== null} onOpenChange={(open) => { if (!open) setStaleOriginal(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除原文件?</AlertDialogTitle>
            <AlertDialogDescription>
              已另存到新位置并重新绑定。原文件仍保留在原位置:
              <span className="mt-1 block break-all font-mono text-xs">{staleOriginal?.path}</span>
              要把它一并删除吗?(正文引用的图片已复制到新位置,原位置的图片不动)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留原文件</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                const target = staleOriginal
                setStaleOriginal(null)
                if (!target) return
                void platformServices.files.deleteFile(target.path)
                  .then(() => toast.success(`已删除原文件: ${target.path}`))
                  .catch((error: unknown) => toast.error(`删除原文件失败: ${error instanceof Error ? error.message : String(error)}`))
              }}
            >
              删除原文件
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
