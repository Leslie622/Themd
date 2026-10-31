import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
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
    return () => {
      offCollapse()
      offSettings()
      offConflict()
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

  // 文件绑定双向同步的落盘时机:Ctrl+S 显式保存;失焦/切后台/托盘退出前冲刷
  useEffect(() => {
    const flush = () => notebookController.flushAll()
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        saveActiveNote()
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
  }, [saveActiveNote])

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
    </AppShell>
  )
}
