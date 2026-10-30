import { useEffect, useMemo, useState } from 'react'
import { ThemeStudio } from '@/components/theme/ThemeStudio'
import { useNotebook } from '@/store'
import { listAllThemes, resolveActiveTheme, useThemeStore } from '@/store-themes'
import { useSyncScroll } from '@/lib/scroll-sync'
import { appEvents } from '@/shared/events/app-events'
import { usePanelRef } from 'react-resizable-panels'
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
  const sidebarPanelRef = usePanelRef()
  const sidebarWidth = useWorkspacePrefs((state) => state.sidebarWidth)
  const setSidebarWidth = useWorkspacePrefs((state) => state.setSidebarWidth)
  const { exportPdf, exportNoteFile } = useExportActions({ active, view, setView })

  useEffect(() => {
    const offCollapse = appEvents.on('collapseSidebar', () => sidebarPanelRef.current?.collapse())
    const offSettings = appEvents.on('openSettings', () => setSettingsOpen(true))
    return () => {
      offCollapse()
      offSettings()
    }
  }, [sidebarPanelRef])

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
      setSidebarCollapsed={setSidebarCollapsed}
      sidebarPanelRef={sidebarPanelRef}
      sidebarWidth={clampSidebarWidth(sidebarWidth)}
      onSidebarWidthCommit={setSidebarWidth}
      settingsOpen={settingsOpen}
      setSettingsOpen={setSettingsOpen}
      setStudioOpen={setStudioOpen}
      updateNote={updateNote}
      createNote={() => createNote()}
      setNoteTheme={setNoteTheme}
      exportPdf={exportPdf}
      exportNoteFile={exportNoteFile}
      bindEditorScroller={bindEditorScroller}
      bindPreviewScroller={bindPreviewScroller}
    />
  )
}
