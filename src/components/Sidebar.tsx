import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  ChevronRight,
  FileInput,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'

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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { readFiles, readFolder, readFolderDesktop } from '@/lib/files'
import { platformServices } from '@/app/platform'
import type { ImportedFile } from '@/lib/files'
import { fromNow } from '@/lib/time'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useNotebook } from '@/store'
import { appEvents } from '@/shared/events/app-events'
import { isPathUnder, isSamePath, normalizePath, noteDirOf } from '@/shared/paths'
import type { Folder as FolderEntity } from '@/modules/notebook/domain/note'
import type { Note } from '@/store'

export function Sidebar() {
  const notes = useNotebook((s) => s.notes)
  const folders = useNotebook((s) => s.folders)
  const activeId = useNotebook((s) => s.activeId)
  const fileMissingIds = useNotebook((s) => s.fileMissingIds)
  const setActive = useNotebook((s) => s.setActive)
  const createNote = useNotebook((s) => s.createNote)
  const renameNote = useNotebook((s) => s.renameNote)
  const removeNote = useNotebook((s) => s.removeNote)
  const createFolder = useNotebook((s) => s.createFolder)
  const renameFolder = useNotebook((s) => s.renameFolder)
  const removeFolder = useNotebook((s) => s.removeFolder)
  const moveNoteToFolder = useNotebook((s) => s.moveNoteToFolder)
  const createNoteInFolder = useNotebook((s) => s.createNoteInFolder)

  const [keyword, setKeyword] = useState('')
  // 文件夹展开状态受控:搜索时强制全开(命中笔记所在的文件夹必须可见),
  // 清空搜索后回到用户手动控制的展开/收起
  const [closedFolders, setClosedFolders] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<
    { kind: 'note' | 'folder'; id: string; value: string } | null
  >(null)
  /** 待删除文件夹:确认后整棵目录移入系统回收站,其中笔记从应用一并移除 */
  const [deletingFolder, setDeletingFolder] = useState<{ id: string; name: string; noteCount: number } | null>(null)
  /** 待删除绑定笔记:确认后磁盘文件移入系统回收站 */
  const [deletingNote, setDeletingNote] = useState<{ id: string; title: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const kw = keyword.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      notes.filter(
        (n) =>
          !kw ||
          n.title.toLowerCase().includes(kw) ||
          n.content.toLowerCase().includes(kw),
      ),
    [notes, kw],
  )
  /** 文件夹=目录:绑定笔记归属其所在目录的文件夹,未绑定笔记平铺在顶层 */
  const folderIdOfNote = useCallback(
    (n: Note): string => {
      const dir = noteDirOf(n.sourcePath)
      if (!dir) return ''
      return folders.find((f) => f.path && isSamePath(f.path, dir))?.id ?? ''
    },
    [folders],
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
   * 目录树展平:按路径排序保证父文件夹在子文件夹前,depth = 祖先目录数(缩进用)。
   * 文件夹与磁盘目录一一对应,只显示出现过的目录。
   */
  const folderNodes = useMemo(() => {
    const depthOf = (f: FolderEntity): number => {
      let depth = 0
      let parent = noteDirOf(f.path)
      while (parent) {
        const dir = parent
        const pf = folders.find((x) => isSamePath(x.path, dir))
        if (!pf) break
        depth++
        parent = noteDirOf(pf.path)
      }
      return depth
    }
    return [...folders]
      .sort((a, b) => normalizePath(a.path).localeCompare(normalizePath(b.path)))
      .map((folder) => ({ folder, depth: depthOf(folder) }))
  }, [folders])

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const imported = await readFiles(files)
    importFiles(imported)
    e.target.value = '' // 允许再次导入同名文件
  }

  /** 桌面端原生文件导入:Rust 返回绝对路径,笔记直接绑定源文件(双向同步) */
  async function handleImportDesktop() {
    const imported = await platformServices.files.pickFiles()
    importFiles(imported)
  }

  /** 把导入的文件落库;带 filePath(仅桌面端)的笔记绑定源文件 */
  function importFiles(imported: ImportedFile[]) {
    for (const f of imported) createNote(f.title, f.content, f.filePath)
  }

  /** 导入文件夹:目录路径 → 自动建文件夹 */
  async function handleFolderImport(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files?.length) return
    const imported = await readFolder(files)
    importFolderFiles(imported)
    e.target.value = ''
  }

  /** 桌面端走原生目录选择(Rust 递归读取,无 WebView2 上传确认弹窗) */
  async function handleFolderImportDesktop() {
    const imported = await readFolderDesktop()
    if (!imported?.length) return
    importFolderFiles(imported)
  }

  /** 把导入的文件夹文件落库:桌面端绑定源文件,文件夹按所在目录自动派生(不变式) */
  function importFolderFiles(imported: ImportedFile[]) {
    for (const f of imported) createNote(f.title, f.content, f.filePath)
  }

  /** 导入文件夹入口:桌面端原生对话框,浏览器端 webkitdirectory 兜底 */
  const handleImportFolderClick = () => {
    if (platformServices.isDesktop) void handleFolderImportDesktop()
    else folderInputRef.current?.click()
  }

  /** 导入文件入口:桌面端走原生对话框(笔记绑定源文件),浏览器端隐藏 input 兜底 */
  const handleImportFileClick = () => {
    if (platformServices.isDesktop) void handleImportDesktop()
    else fileInputRef.current?.click()
  }

  /** 新建文件夹 = 选一个(或经系统对话框新建)磁盘目录 */
  async function handleCreateFolder() {
    if (!platformServices.isDesktop) return
    const dir = await platformServices.files.pickDirectory()
    if (!dir) return
    createFolder(dir)
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
    onReveal:
      platformServices.isDesktop
        ? () =>
            platformServices.files.revealItemInDir(f.path).catch((error: unknown) => {
              toast.error(`打开文件位置失败: ${error instanceof Error ? error.message : String(error)}`)
            })
        : undefined,
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
      onReveal={
        n.sourcePath && platformServices.isDesktop
          ? () =>
              platformServices.files.revealItemInDir(n.sourcePath!).catch((error: unknown) => {
                toast.error(`打开文件位置失败: ${error instanceof Error ? error.message : String(error)}`)
              })
          : undefined
      }
    />
  )

  return (
    <TooltipProvider delayDuration={300}>
      <aside className="flex h-full w-full flex-col overflow-hidden bg-sidebar [contain:strict]">
      <div className="flex flex-col gap-3.5 border-b px-4 pb-3.5 pt-3">
        <div
          data-tauri-drag-region
          className="flex h-10 items-center justify-between text-foreground"
        >
          {/* 桌面端无原生标题栏,logo 行即窗口左上角的拖拽区 */}
          <img
            src="/themd-logo.png"
            alt="Themd"
            data-tauri-drag-region
            className="h-4 w-auto shrink-0"
          />
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => appEvents.emit('collapseSidebar')}
                  aria-label="收起侧栏"
                >
                  <PanelLeftClose />
                </Button>
              </TooltipTrigger>
              <TooltipContent>收起侧栏</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {/* 主操作实心,次级操作 ghost 降噪,整行只剩一个视觉重心 */}
        <div className="flex items-center gap-1">
          <Button className="flex-1" onClick={() => createNote()}>
            <Plus /> 新建
          </Button>
          {/* 文件夹=目录,仅桌面端有目录能力;Web 端笔记平铺 */}
          {platformServices.isDesktop && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => void handleCreateFolder()}
                  aria-label="新建文件夹"
                >
                  <FolderPlus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>新建文件夹:选择(或新建)磁盘目录</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                onClick={handleImportFileClick}
                aria-label="导入文件"
              >
                <FileInput />
              </Button>
            </TooltipTrigger>
            <TooltipContent>导入 .md 文件</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                onClick={handleImportFolderClick}
                aria-label="导入文件夹"
              >
                <FolderInput />
              </Button>
            </TooltipTrigger>
            <TooltipContent>导入文件夹</TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            multiple
            hidden
            onChange={handleImport}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error 非标准属性,Chromium 支持
            webkitdirectory=""
            hidden
            onChange={handleFolderImport}
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索笔记..."
            className="rounded-full pl-8"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {folderNodes.map(({ folder: f, depth }) => {
          const items = byFolder.get(f.id) ?? []
          // 搜索态:没有命中笔记的文件夹整个隐藏,连"空文件夹"占位一起
          if (kw && items.length === 0) return null
          // 搜索时强制展开(忽略手动收起),无搜索时按用户手动状态
          const open = kw ? true : !closedFolders.has(f.id)
          const noteCount = notes.filter((n) => isPathUnder(n.sourcePath, f.path)).length
          return (
            <Collapsible
              key={f.id}
              open={open}
              onOpenChange={(v) =>
                setClosedFolders((prev) => {
                  const next = new Set(prev)
                  if (v) next.delete(f.id)
                  else next.add(f.id)
                  return next
                })
              }
            >
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div className="group/row flex items-center rounded-lg transition-colors hover:bg-sidebar-accent" style={{ marginLeft: depth * 14 }}>
                    <CollapsibleTrigger className="group/chev flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-sm font-medium">
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/chev:rotate-90" />
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                        <Folder className="size-3" />
                      </span>
                      <span className="truncate" title={f.path}>{f.name}</span>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </CollapsibleTrigger>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 data-[state=open]:opacity-100"
                          aria-label={`文件夹 ${f.name} 操作`}
                        >
                          <MoreHorizontal className="size-4" />
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
                {/* 文件夹内笔记缩进并加参考线,和根目录笔记拉开层级 */}
                <div className="ml-4 border-l border-sidebar-border/70 pl-1.5" style={{ marginLeft: depth * 14 + 16 }}>
                  {items.map(renderNoteItem)}
                  {items.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">空文件夹</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}

        {(byFolder.get('') ?? []).map(renderNoteItem)}

        {notes.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            没有匹配的笔记
          </p>
        )}
        {notes.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <FileText className="size-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">
              还没有笔记，点「新建」或「导入」开始
            </p>
          </div>
        )}
      </nav>
      </aside>

      {/* 删除文件夹 = 删除磁盘目录(移入系统回收站,可恢复);其中笔记从应用一并移除 */}
      <AlertDialog
        open={deletingFolder !== null}
        onOpenChange={(open) => !open && setDeletingFolder(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文件夹「{deletingFolder?.name}」?</AlertDialogTitle>
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
            <AlertDialogTitle>删除笔记「{deletingNote?.title}」?</AlertDialogTitle>
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
    </TooltipProvider>
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

/** 内容命中时截取关键字前后各约 30 字符做摘要行,让用户知道命中在哪 */
function matchSnippet(content: string, keyword: string): string | null {
  const hit = content.toLowerCase().indexOf(keyword.toLowerCase())
  if (hit === -1) return null
  const start = Math.max(0, hit - 30)
  const end = Math.min(content.length, hit + keyword.length + 30)
  return (start > 0 ? '…' : '') + content.slice(start, end).replace(/\s+/g, ' ') + (end < content.length ? '…' : '')
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
  /** 打开文件位置(资源管理器);Web 端不传则不显示 */
  onReveal?: () => void
  onDelete: () => void
}) {
  const { Item, Separator } = parts
  return (
    <>
      <Item onClick={onRename}>
        <Pencil /> 重命名文件夹
      </Item>
      <Item onClick={onCreateNote}>
        <Plus /> 在此文件夹新建笔记
      </Item>
      {onReveal && (
        <Item onClick={onReveal}>
          <FolderOpen /> 打开文件位置
        </Item>
      )}
      <Separator />
      <Item variant="destructive" onClick={onDelete}>
        <Trash2 /> 删除文件夹(移入回收站)
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
  onMove: (folderId: string | null) => void
  /** 打开文件位置(资源管理器);未绑定文件/Web 端不传则不显示 */
  onReveal?: () => void
  onDelete: () => void
  /** 展平的目录树(父文件夹在前),depth 决定缩进 */
  folders: { folder: FolderEntity; depth: number }[]
  /** 当前所在文件夹 id;'' = 未绑定笔记平铺在顶层 */
  currentFolderId: string | null
}) {
  const { Item, Sub, SubTrigger, SubContent, Separator } = parts
  return (
    <>
      <Item onClick={onRename}>
        <Pencil /> 重命名
      </Item>
      {onReveal && (
        <Item onClick={onReveal}>
          <FolderOpen /> 打开文件位置
        </Item>
      )}
      <Sub>
        <SubTrigger>
          <FolderInput /> 移动到文件夹
        </SubTrigger>
        {/* 菜单默认宽度跟随触发器,被 min-w-32 兜底;文件夹名长时避免换行 */}
        <SubContent className="min-w-32">
          {/* 绑定笔记永远属于其所在目录的文件夹,没有「未文件夹」;移动即物理搬文件 */}
          {!currentFolderId && (
            <Item disabled>✓ 未绑定文件</Item>
          )}
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
        <Trash2 /> 删除
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
  /** 搜索关键字:空串表示非搜索态,不做高亮、不显示摘要 */
  keyword: string
  onClick: () => void
  onRename: () => void
  onDelete: () => void
  folders: { folder: FolderEntity; depth: number }[]
  currentFolderId: string | null
  onMove: (folderId: string | null) => void
  /** 打开文件位置(资源管理器);未绑定文件/Web 端为 undefined,菜单不显示该项 */
  onReveal?: () => void
}) {
  const titleHit = keyword && note.title.toLowerCase().includes(keyword.toLowerCase())
  const snippet = keyword && !titleHit ? matchSnippet(note.content, keyword) : null

  // 图标统一 FileText——笔记本质是 md 文件;绑定态用实心芯片区分(未绑定=淡色),
  // 悬停显示绑定的源文件名
  const boundName = note.sourcePath?.split(/[\\/]/).pop()
  const icon = (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-md',
            note.sourcePath
              ? 'bg-sky-600 text-white dark:bg-sky-500'
              : 'bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400',
          )}
        >
          <FileText className="size-4" />
        </span>
      </TooltipTrigger>
      {boundName && <TooltipContent side="right">已绑定 {boundName}</TooltipContent>}
    </Tooltip>
  )
  const titleArea = (
    <span className="min-w-0 flex-1">
      <span className={cn('block truncate', active && 'font-medium')}>
        <Highlight text={note.title} keyword={keyword} />
      </span>
      {snippet ? (
        <span className="block truncate text-xs text-muted-foreground">
          <Highlight text={snippet} keyword={keyword} />
        </span>
      ) : (
        <span className="block truncate text-xs text-muted-foreground">
          {fromNow(note.updatedAt)}
        </span>
      )}
    </span>
  )

  return (
    <ContextMenu>
      {/* 右键任意位置唤出操作菜单;菜单回调逐条目绑定,操作对象与选中状态无关 */}
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'group flex w-full items-center gap-2 rounded-lg pr-1 transition-colors hover:bg-sidebar-accent',
            active ? 'bg-sidebar-accent' : '',
          )}
        >
          <button
            type="button"
            onClick={onClick}
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm"
          >
            {icon}
            {titleArea}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label={`笔记 ${note.title} 操作`}
              >
                <MoreHorizontal className="size-4" />
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
        </div>
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
