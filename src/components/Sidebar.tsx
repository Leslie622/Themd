import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  IconChevronRight,
  IconCopy,
  IconFileText,
  IconFolder,
  IconFolderDown,
  IconFolderOpen,
  IconFolderPlus,
  IconDots,
  IconLayoutSidebarLeftCollapse,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'

import { ThemdLogo } from '@/components/ThemdLogo'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { AutoHideScrollArea } from '@/components/AutoHideScrollArea'
import { Tip } from '@/components/Tip'
import { platformServices } from '@/app/platform'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useNotebook } from '@/store'
import { useWorkspacePrefs } from '@/app/workspace-preferences'
import { appEvents } from '@/shared/events/app-events'
import { isPathUnder, isSamePath, normalizePath, noteDirOf, pathBaseName } from '@/shared/paths'
import type { Folder as FolderEntity } from '@/modules/notebook/domain/note'
import type { Note } from '@/store'

export function Sidebar() {
  const notes = useNotebook((s) => s.notes)
  const folders = useNotebook((s) => s.folders)
  const activeId = useNotebook((s) => s.activeId)
  const fileMissingIds = useNotebook((s) => s.fileMissingIds)
  const setActive = useNotebook((s) => s.setActive)
  const renameNote = useNotebook((s) => s.renameNote)
  const removeNote = useNotebook((s) => s.removeNote)
  const createFolder = useNotebook((s) => s.createFolder)
  const renameFolder = useNotebook((s) => s.renameFolder)
  const removeFolder = useNotebook((s) => s.removeFolder)
  const moveNoteToFolder = useNotebook((s) => s.moveNoteToFolder)
  const createNoteInFolder = useNotebook((s) => s.createNoteInFolder)
  const createNoteInDir = useNotebook((s) => s.createNoteInDir)
  const workspaceRoot = useNotebook((s) => s.workspaceRoot)
  const openWorkspace = useNotebook((s) => s.openWorkspace)
  const closeWorkspace = useNotebook((s) => s.closeWorkspace)

  const [keyword, setKeyword] = useState('')
  // 文件夹展开状态受控,默认全部折叠(对齐 Typora,点开才展开);
  // 搜索时强制全开(命中笔记所在的文件夹必须可见),清空搜索后回到手动状态
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<
    { kind: 'note' | 'folder'; id: string; value: string } | null
  >(null)
  /** 待删除文件夹:确认后整棵目录移入系统回收站,其中笔记从应用一并移除 */
  const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string; noteCount: number } | null>(null)
  /** 待删除绑定笔记:确认后磁盘文件移入系统回收站 */
  const [deletingNote, setDeletingNote] = useState<{ id: string; title: string } | null>(null)

  const kw = keyword.trim().toLowerCase()
  // 搜索只匹配标题(=文件名):正文懒加载后未打开的笔记内存里没有全文,
  // 标题搜索零开销且覆盖全部笔记
  const filtered = useMemo(
    () =>
      notes.filter(
        (n) => !kw || n.title.toLowerCase().includes(kw),
      ),
    [notes, kw],
  )
  /** 文件夹=目录:绑定笔记归属其所在目录的文件夹,未绑定笔记平铺在顶层 */
  const folderIdOfNote = useCallback(
    (n: Note): string => {
      const dir = noteDirOf(n.sourcePath)
      if (!dir) return ''
      // 工作区根不是树里的可折叠节点,根目录笔记归入顶层
      if (isSamePath(dir, workspaceRoot)) return ''
      return folders.find((f) => f.path && isSamePath(f.path, dir))?.id ?? ''
    },
    [folders, workspaceRoot],
  )
  const byFolder = useMemo(() => {
    const map = new Map<string, Note[]>()
    for (const n of filtered) {
      const key = folderIdOfNote(n)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(n)
    }
    return map
  }, [filtered, folderIdOfNote])
  /**
   * 目录树:按父目录分组的子目录索引(同层按名称排序),渲染时递归嵌套——
   * 子文件夹真正渲染进父文件夹的 CollapsibleContent,折叠父级时子树整体收起。
   * 只取工作区内的目录;根自身是静态标题行,不作为树节点。
   */
  const childFolders = useMemo(() => {
    const map = new Map<string, FolderEntity[]>()
    if (!workspaceRoot) return map
    for (const folder of folders) {
      if (isSamePath(folder.path, workspaceRoot)) continue
      if (!isPathUnder(folder.path, workspaceRoot)) continue
      const key = normalizePath(noteDirOf(folder.path) ?? '')
      const bucket = map.get(key)
      if (bucket) bucket.push(folder)
      else map.set(key, [folder])
    }
    for (const bucket of map.values()) bucket.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [folders, workspaceRoot])

  /** 目录树展平(DFS 序,depth 来自树的层数);「移动到文件夹」菜单缩进用 */
  const folderNodes = useMemo(() => {
    const nodes: { folder: FolderEntity; depth: number }[] = []
    const walk = (dir: string, depth: number) => {
      for (const folder of childFolders.get(normalizePath(dir)) ?? []) {
        nodes.push({ folder, depth })
        walk(folder.path, depth + 1)
      }
    }
    if (workspaceRoot) walk(workspaceRoot, 0)
    return nodes
  }, [childFolders, workspaceRoot])

  /** 工作区记忆(prefs 持久化);控制器只管打开,记忆归 UI 层 */
  const recents = useWorkspacePrefs((s) => s.recents)
  const rememberWorkspace = useWorkspacePrefs((s) => s.rememberWorkspace)
  const forgetWorkspace = useWorkspacePrefs((s) => s.forgetWorkspace)

  /** 打开目录为工作区:递归导入 + 递归监听 + 记忆到最近列表 */
  const openDir = (dir: string) => {
    void openWorkspace(dir)
      .then(() => rememberWorkspace(dir))
      .catch((error: unknown) => {
        toast.error(`打开工作区失败: ${error instanceof Error ? error.message : String(error)}`)
      })
  }

  /** 系统目录选择器 → 打开为工作区 */
  const pickAndOpenDir = () => {
    void platformServices.files.pickDirectory().then((dir) => {
      if (dir) openDir(dir)
    })
  }

  /** 在工作区根新建笔记并激活(侧栏「新建」;文件夹内右键走 createNoteInFolder) */
  const handleCreateNote = () => {
    if (!workspaceRoot) return
    void createNoteInDir(workspaceRoot)
      .then((id) => setActive(id))
      .catch((error: unknown) => {
        toast.error(`新建笔记失败: ${error instanceof Error ? error.message : String(error)}`)
      })
  }

  /** 新建文件夹 = 选一个(或经系统对话框新建)磁盘目录;必须在工作区内,
   *  否则会得到树里不可见却持久化的僵尸 Folder 实体 */
  async function handleCreateFolder() {
    const dir = await platformServices.files.pickDirectory()
    if (!dir) return
    if (workspaceRoot && !isPathUnder(dir, workspaceRoot)) {
      toast.error('所选目录不在工作区内')
      return
    }
    createFolder(dir)
  }

  /** 空白区右键:复制工作区根路径 */
  const copyRootPath = () => {
    const root = workspaceRoot
    if (!root) return
    void navigator.clipboard
      .writeText(root)
      .then(() => toast.success('已复制文件路径'))
      .catch(() => toast.error('复制文件路径失败'))
  }

  /** 空白区右键:在文件管理器中定位工作区根目录 */
  const revealRoot = () => {
    const root = workspaceRoot
    if (!root) return
    platformServices.files.revealItemInDir(root).catch((error: unknown) => {
      toast.error(`打开文件位置失败: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const commitRename = () => {
    if (!renaming) return
    const name = renaming.value.trim()
    // 空名不提交也不关弹窗,让用户改到合法为止
    if (!name) return
    if (renaming.kind === 'note') {
      // 绑定笔记的重命名 = 磁盘文件改名(双向);失败 toast 提示(弹窗照常关闭)
      void renameNote(renaming.id, name).catch((error: unknown) => {
        toast.error(`重命名笔记失败: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    else {
      // 文件夹重命名 = 磁盘目录改名,失败(占用/跨盘/重名)提示且不改状态
      void renameFolder(renaming.id, name).catch((error: unknown) => {
        toast.error(`重命名文件夹失败: ${error instanceof Error ? error.message : String(error)}`)
      })
    }
    setRenaming(null)
  }

  /** 文件夹操作回调:「⋯」下拉与右键菜单共用一份(见 FolderMenuItems 的两处使用) */
  const folderActions = (f: FolderEntity, noteCount: number) => ({
    onRename: () => setRenaming({ kind: 'folder', id: f.id, value: f.name }),
    onCreateNote: () => {
      void createNoteInFolder(f.id)
        .then((id) => setActive(id))
        .catch((error: unknown) => {
          toast.error(`新建笔记失败: ${error instanceof Error ? error.message : String(error)}`)
        })
    },
    onReveal: () =>
      platformServices.files.revealItemInDir(f.path).catch((error: unknown) => {
        toast.error(`打开文件位置失败: ${error instanceof Error ? error.message : String(error)}`)
      }),
    onDelete: () => setDeletingFolder({ id: f.id, name: f.name, noteCount }),
  })

  const renderNoteItem = (n: Note) => (
    <NoteItem
      key={n.id}
      note={n}
      active={n.id === activeId}
      keyword={kw}
      onClick={() => setActive(n.id)}
      onRename={() => setRenaming({ kind: 'note', id: n.id, value: n.title })}
      onDelete={() => {
        if (n.sourcePath && !fileMissingIds.has(n.id)) {
          setDeletingNote({ id: n.id, title: n.title })
        } else {
          // 未绑定/失联笔记:仅从应用移除,不碰磁盘
          void removeNote(n.id).catch((error: unknown) => {
            toast.error(`删除笔记失败: ${error instanceof Error ? error.message : String(error)}`)
          })
        }
      }}
      folders={folderNodes}
      currentFolderId={folderIdOfNote(n)}
      onMove={(folderId) => {
        void moveNoteToFolder(n.id, folderId).catch((error: unknown) => {
          toast.error(`移动笔记失败: ${error instanceof Error ? error.message : String(error)}`)
        })
      }}
      onReveal={() =>
        platformServices.files.revealItemInDir(n.sourcePath).catch((error: unknown) => {
          toast.error(`打开文件位置失败: ${error instanceof Error ? error.message : String(error)}`)
        })
      }
    />
  )

  /**
   * 递归渲染目录树:每个文件夹的子文件夹与笔记都在其 CollapsibleContent 内,
   * 折叠父级 = 整棵子树收起;缩进由每层的参考线容器逐级累加。
   * 搜索态:子树无任何命中笔记的文件夹整棵隐藏,命中则强制全开。
   */
  const renderFolderRows = (parentPath: string, depth: number): React.ReactNode[] =>
    (childFolders.get(normalizePath(parentPath)) ?? []).flatMap((f) => {
      const items = byFolder.get(f.id) ?? []
      const childRows = renderFolderRows(f.path, depth + 1)
      if (kw && items.length === 0 && childRows.length === 0) return []
      const open = kw ? true : openFolders.has(f.id)
      const noteCount = notes.filter((n) => isPathUnder(n.sourcePath, f.path)).length
      return [
        <Collapsible
          key={f.id}
          open={open}
          onOpenChange={(v) =>
            setOpenFolders((prev) => {
              const next = new Set(prev)
              if (v) next.add(f.id)
              else next.delete(f.id)
              return next
            })
          }
        >
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="group/row list-row-wipe flex items-center rounded-lg">
                <CollapsibleTrigger className="group/chev flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm font-medium">
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/chev:rotate-90" />
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                    <IconFolder className="size-3" />
                  </span>
                  <Tip label={f.path}>
                    <span className="truncate">{f.name}</span>
                  </Tip>
                </CollapsibleTrigger>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0 opacity-0 duration-400 focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
                      aria-label={`文件夹 ${f.name} 操作`}
                    >
                      <IconDots className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-40">
                    <FolderMenuItems
                      parts={{ Item: DropdownMenuItem, Separator: DropdownMenuSeparator }}
                      {...folderActions(f, noteCount)}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </ContextMenuTrigger>
            {/* 右键文件夹行:与「⋯」完全同一套操作 */}
            <ContextMenuContent className="min-w-40">
              <FolderMenuItems
                parts={{ Item: ContextMenuItem, Separator: ContextMenuSeparator }}
                {...folderActions(f, noteCount)}
              />
            </ContextMenuContent>
          </ContextMenu>
          <CollapsibleContent>
            {/* 子文件夹与笔记缩进并加参考线,每层容器逐级累加缩进 */}
            <div className="ml-4 border-l border-sidebar-border/70 pl-1.5">
              {childRows}
              {/* 新增/删除/移动笔记:进出场高度+淡入过渡,兄弟行由文档流自然推动。
                  key=kw:搜索每次击键都增删条目,重挂载让过滤增减直接落位,
                  避免清空搜索时整列表重播入场 */}
              <AnimatePresence key={kw} initial={false}>
                {items.map(renderNoteItem)}
              </AnimatePresence>
              {items.length === 0 && childRows.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">空文件夹</p>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>,
      ]
    })

  return (
    <>
      <aside className="flex h-full w-full flex-col overflow-hidden bg-sidebar [contain:strict]">
      <div className="flex flex-col gap-3.5 px-4 pb-1.5 pt-3">
        <div
          data-tauri-drag-region
          className="flex h-10 items-center justify-between text-foreground"
        >
          {/* 桌面端无原生标题栏,logo 行即窗口左上角的拖拽区;SVG 设 pointer-events-none,点击穿透到带拖拽属性的行容器 */}
          <ThemdLogo className="h-4 w-auto shrink-0 pointer-events-none" />
          <div className="flex items-center gap-0.5">
            <Tip label="收起侧栏">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => appEvents.emit('collapseSidebar')}
                aria-label="收起侧栏"
              >
                <IconLayoutSidebarLeftCollapse className="size-[18px]" />
              </Button>
            </Tip>
          </div>
        </div>
        <div className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索笔记"
            className="rounded-full pl-8"
          />
        </div>
      </div>

      <AutoHideScrollArea className="flex-1">
        <div className="flex h-full flex-col space-y-0.5 p-2">
        {/* 无工作区:引导打开目录(folder-first 的起点) */}
        {!workspaceRoot && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-12 text-center">
            <IconFolderOpen className="size-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">打开一个目录作为工作区</p>
            <Button onClick={pickAndOpenDir}>
              <IconFolderOpen /> 打开目录
            </Button>
          </div>
        )}
        {/* 工作区根:静态标题行(不可折叠、无操作),层级从根的子目录起算——对齐 Typora */}
        {workspaceRoot && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
              <IconFolder className="size-3" />
            </span>
            <Tip label={workspaceRoot}>
              <span className="truncate">
                {pathBaseName(workspaceRoot)}
              </span>
            </Tip>
          </div>
        )}

        {workspaceRoot && notes.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <IconFileText className="size-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              工作区还没有笔记，点「新建」开始
            </p>
          </div>
        )}
        {workspaceRoot && renderFolderRows(workspaceRoot, 0)}

        {/* 根目录笔记:和顶级文件夹同一层级,参考线对齐文件夹内容——层级全部从根标题起算 */}
        {workspaceRoot ? (
          <div className="ml-4 border-l border-sidebar-border/70 pl-1.5">
            <AnimatePresence key={kw} initial={false}>
              {(byFolder.get('') ?? []).map(renderNoteItem)}
            </AnimatePresence>
          </div>
        ) : (
          <AnimatePresence key={kw} initial={false}>
            {(byFolder.get('') ?? []).map(renderNoteItem)}
          </AnimatePresence>
        )}

        {notes.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            没有匹配的笔记
          </p>
        )}

        {/* 列表空白区右键:工作区级操作(Typora 同款);只挂在列表下方的空白填充上,不与行菜单冲突 */}
        {workspaceRoot && (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="min-h-24 flex-1" />
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-40">
              <ContextMenuItem onClick={handleCreateNote}>
                <IconPlus /> 新建文件
              </ContextMenuItem>
              <ContextMenuItem onClick={() => void handleCreateFolder()}>
                <IconFolderPlus /> 新建文件夹
              </ContextMenuItem>
              <ContextMenuItem onClick={copyRootPath}>
                <IconCopy /> 复制文件路径
              </ContextMenuItem>
              <ContextMenuItem onClick={revealRoot}>
                <IconFolderOpen /> 打开文件位置
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )}
        </div>
      </AutoHideScrollArea>

      {/* 工作区胶囊固定侧栏底部:目录是全局上下文,不是头部操作;「新建」在其左侧 */}
      <div className="flex items-center gap-1 p-2">
        <Tip label="在工作区根新建笔记">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            disabled={!workspaceRoot}
            onClick={handleCreateNote}
            aria-label="新建笔记"
          >
            <IconPlus className="size-[18px]" />
          </Button>
        </Tip>
        <div className="min-w-0 flex-1">
          <WorkspacePill
            workspaceRoot={workspaceRoot}
            recents={recents}
            onOpenDir={openDir}
            onPickDir={pickAndOpenDir}
            onClear={() => {
              void closeWorkspace()
                .then(() => forgetWorkspace())
                .catch((error: unknown) => {
                  toast.error(`清除工作区失败: ${error instanceof Error ? error.message : String(error)}`)
                })
            }}
          />
        </div>
      </div>
    </aside>

      {/* 删除文件夹 = 删除磁盘目录(移入系统回收站,可恢复);其中笔记从应用一并移除 */}
      <AlertDialog
        open={deletingFolder !== null}
        onOpenChange={(open) => !open && setDeletingFolder(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              删除文件夹「{deletingFolder?.name}」?
            </AlertDialogTitle>
            <AlertDialogDescription>
              将把该目录及其全部内容移入<b>系统回收站</b>(可恢复)。其中 {deletingFolder?.noteCount ?? 0} 篇笔记会同时从应用移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = deletingFolder
                setDeletingFolder(null)
                if (!target) return
                void removeFolder(target.id).catch((error: unknown) => {
                  toast.error(`删除文件夹失败: ${error instanceof Error ? error.message : String(error)}`)
                })
              }}
            >
              删除目录
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除绑定笔记 = 磁盘文件移入回收站(可恢复);未绑定笔记不走此弹窗 */}
      <AlertDialog
        open={deletingNote !== null}
        onOpenChange={(open) => !open && setDeletingNote(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="[overflow-wrap:anywhere]">
              删除笔记「{deletingNote?.title}」?
            </AlertDialogTitle>
            <AlertDialogDescription>
              将把对应的磁盘文件移入<b>系统回收站</b>(可恢复)。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = deletingNote
                setDeletingNote(null)
                if (!target) return
                void removeNote(target.id).catch((error: unknown) => {
                  toast.error(`删除笔记失败: ${error instanceof Error ? error.message : String(error)}`)
                })
              }}
            >
              删除并移入回收站
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 重命名弹窗:笔记/文件夹共用。不用内联编辑——WebView2 在菜单关闭后
          会程序性抢焦,内联输入框的聚焦/失焦都不可靠;弹窗内 Radix Dialog
          自带焦点管理,完全避开 */}
      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {renaming?.kind === 'folder' ? '重命名文件夹' : '重命名笔记'}
            </DialogTitle>
            <DialogDescription>
              {renaming?.kind === 'folder' ? '将同步改名对应的磁盘目录。' : '输入新的笔记标题。'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renaming?.value ?? ''}
            aria-label="新名称"
            onChange={(e) =>
              setRenaming((r) => (r ? { ...r, value: e.target.value } : r))
            }
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(null)
            }}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button onClick={commitRename}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** 工作区胶囊:当前目录名 + 下拉(最近工作区/打开其他目录/清除) */
function WorkspacePill({
  workspaceRoot,
  recents,
  onOpenDir,
  onPickDir,
  onClear,
}: {
  /** null = 未打开工作区 */
  workspaceRoot: string | null
  /** 最近工作区列表(新→旧) */
  recents: string[]
  onOpenDir: (dir: string) => void
  onPickDir: () => void
  onClear: () => void
}) {
  const name = workspaceRoot ? pathBaseName(workspaceRoot) : null
  return (
    <DropdownMenu>
      <Tip label={workspaceRoot ?? '未打开工作区'}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 bg-muted/40 text-xs text-muted-foreground"
          >
            <IconFolderOpen className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{name ?? '未打开工作区'}</span>
            <IconChevronRight className="size-3 shrink-0 rotate-90 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
      </Tip>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuItem onClick={onPickDir}>
          <IconFolderOpen /> 打开目录…
        </DropdownMenuItem>
        {recents.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>最近工作区</DropdownMenuLabel>
            {recents.map((r) => (
              <Tip key={r} label={r}>
                <DropdownMenuItem onClick={() => onOpenDir(r)}>
                  <IconFolder className="text-muted-foreground" />
                  <span className="min-w-0 truncate">
                    {pathBaseName(r)}
                  </span>
                </DropdownMenuItem>
              </Tip>
            ))}
          </>
        )}
        {workspaceRoot && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onClear}>
              <IconTrash /> 清除工作区
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** 把文本按命中关键字切片高亮;大小写不敏感,纯展示用 */
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>
  const lower = text.toLowerCase()
  const kw = keyword.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < text.length) {
    const hit = lower.indexOf(kw, i)
    if (hit === -1) {
      parts.push(text.slice(i))
      break
    }
    if (hit > i) parts.push(text.slice(i, hit))
    parts.push(
      <mark key={key++} className="rounded-xs bg-amber-200/70 text-inherit dark:bg-amber-400/30">
        {text.slice(hit, hit + kw.length)}
      </mark>,
    )
    i = hit + kw.length
  }
  return <>{parts}</>
}

/** 文件夹操作项:「⋯」下拉和右键菜单共用同一套 */
function FolderMenuItems({
  parts,
  onRename,
  onCreateNote,
  onReveal,
  onDelete,
}: {
  parts: { Item: React.ElementType; Separator: React.ElementType }
  onRename: () => void
  onCreateNote: () => void
  /** 打开文件位置(资源管理器) */
  onReveal: () => void
  onDelete: () => void
}) {
  const { Item, Separator } = parts
  return (
    <>
      <Item onClick={onRename}>
        <IconPencil /> 重命名文件夹
      </Item>
      <Item onClick={onCreateNote}>
        <IconPlus /> 在此文件夹新建笔记
      </Item>
      <Item onClick={onReveal}>
        <IconFolderOpen /> 打开文件位置
      </Item>
      <Separator />
      <Item variant="destructive" onClick={onDelete}>
        <IconTrash /> 删除文件夹(移入回收站)
      </Item>
    </>
  )
}

/** 笔记操作项:「⋯」下拉和右键菜单共用同一套,parts 传入对应组件族的 Sub 系列 */
function NoteMenuItems({
  parts,
  onRename,
  onMove,
  onReveal,
  onDelete,
  folders,
  currentFolderId,
}: {
  parts: {
    Item: React.ElementType
    Sub: React.ElementType
    SubTrigger: React.ElementType
    SubContent: React.ElementType
    Separator: React.ElementType
  }
  onRename: () => void
  onMove: (folderId: string) => void
  /** 打开文件位置(资源管理器) */
  onReveal: () => void
  onDelete: () => void
  /** 展平的目录树(父文件夹在前),depth 决定缩进 */
  folders: { folder: FolderEntity; depth: number }[]
  /** 当前所在文件夹 id */
  currentFolderId: string
}) {
  const { Item, Sub, SubTrigger, SubContent, Separator } = parts
  return (
    <>
      <Item onClick={onRename}>
        <IconPencil /> 重命名
      </Item>
      <Item onClick={onReveal}>
        <IconFolderOpen /> 打开文件位置
      </Item>
      <Sub>
        {/* ContextMenuSubTrigger 基类缺 gap-2(与 Dropdown 版不一致),此处覆盖补齐 */}
        <SubTrigger className="gap-2">
          <IconFolderDown /> 移动到文件夹
        </SubTrigger>
        {/* 菜单默认宽度跟随触发器,被 min-w-32 兜底;文件夹名长时避免换行 */}
        <SubContent className="min-w-32">
          {folders.map(({ folder, depth }) => (
            <Item
              key={folder.id}
              onClick={() => onMove(folder.id)}
              style={{ paddingLeft: depth * 14 + 8 }}
            >
              {currentFolderId === folder.id ? '✓ ' : ''}
              {folder.name}
            </Item>
          ))}
        </SubContent>
      </Sub>
      <Separator />
      <Item variant="destructive" onClick={onDelete}>
        <IconTrash /> 删除
      </Item>
    </>
  )
}

function NoteItem({
  note,
  active,
  keyword,
  onClick,
  onRename,
  onDelete,
  folders,
  currentFolderId,
  onMove,
  onReveal,
}: {
  note: Note
  active: boolean
  /** 搜索关键字:空串表示非搜索态,不做高亮 */
  keyword: string
  onClick: () => void
  onRename: () => void
  onDelete: () => void
  folders: { folder: FolderEntity; depth: number }[]
  currentFolderId: string
  onMove: (folderId: string) => void
  /** 打开文件位置(资源管理器) */
  onReveal: () => void
}) {
  // 图标统一 IconFileText——笔记本质是工作区内的 md 文件,悬停显示源文件名
  const boundName = pathBaseName(note.sourcePath)
  const icon = (
    <Tip label={`已绑定 ${boundName}`} side="right">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400">
        <IconFileText className="size-3" />
      </span>
    </Tip>
  )
  // 单行(对齐 Typora 的文件列表密度);搜索命中片段由 Highlight 高亮
  const titleArea = (
    <span className="min-w-0 flex-1">
      <span className={cn('block truncate', active && 'font-medium')}>
        <Highlight text={note.title} keyword={keyword} />
      </span>
    </span>
  )

  return (
    <ContextMenu>
      {/* 右键任意位置唤出操作菜单;菜单回调逐条目绑定,操作对象与选中状态无关 */}
      <ContextMenuTrigger asChild>
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            'group list-row-wipe flex w-full items-center gap-2 overflow-hidden rounded-lg pr-1',
            active ? 'bg-sidebar-accent' : '',
          )}
        >
          <button
            type="button"
            onClick={onClick}
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
          >
            {icon}
            {titleArea}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 duration-400 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label={`笔记 ${note.title} 操作`}
              >
                <IconDots className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            {/* 菜单默认宽度跟随 ⋯ 触发器,被 min-w-32 兜底;「移动到文件夹」差一点就换行,加宽到 min-w-44 */}
            <DropdownMenuContent align="end" className="min-w-44">
              <NoteMenuItems
                parts={{
                  Item: DropdownMenuItem,
                  Sub: DropdownMenuSub,
                  SubTrigger: DropdownMenuSubTrigger,
                  SubContent: DropdownMenuSubContent,
                  Separator: DropdownMenuSeparator,
                }}
                onRename={onRename}
                onMove={onMove}
                onReveal={onReveal}
                onDelete={onDelete}
                folders={folders}
                currentFolderId={currentFolderId}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-44">
        <NoteMenuItems
          parts={{
            Item: ContextMenuItem,
            Sub: ContextMenuSub,
            SubTrigger: ContextMenuSubTrigger,
            SubContent: ContextMenuSubContent,
            Separator: ContextMenuSeparator,
          }}
          onRename={onRename}
          onMove={onMove}
          onReveal={onReveal}
          onDelete={onDelete}
          folders={folders}
          currentFolderId={currentFolderId}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}
