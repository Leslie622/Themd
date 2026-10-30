import { useEffect, useState } from 'react'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listAllThemes, useThemeStore } from '@/store-themes'
import { EDITOR_FONT_RANGE, useEditorPrefs } from '@/store-editor'
import { useAppearance } from '@/store-appearance'
import { platformServices } from '@/app/platform'
import { Minus, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { FontField } from './settings/FontField'
import { useLocalFontList } from './settings/use-local-font-list'

/**
 * 单个字体字段:显示当前值,点击打开完整字体列表弹窗。
 * 值本身是自由文本——支持像 font-family 一样填多个逗号分隔的族名。
 */
function FontSlot({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  mono?: boolean
}) {
  const { fonts } = useLocalFontList()
  return (
    <FontField
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      mono={mono}
      fonts={fonts}
    />
  )
}

/** 字体对:西文 + 中文(浏览器按字符分流) */
function FontPair({
  western,
  cjk,
  onWestern,
  onCjk,
  mono,
}: {
  western: string
  cjk: string
  onWestern: (v: string) => void
  onCjk: (v: string) => void
  mono?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <FontSlot
        label="西文"
        value={western}
        onChange={onWestern}
        placeholder="默认"
        mono={mono}
      />
      <FontSlot
        label="中文"
        value={cjk}
        onChange={onCjk}
        placeholder="系统默认"
        mono={mono}
      />
    </div>
  )
}

/** 应用设置抽屉:字体、编辑器偏好等。 */
export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fontSize = useEditorPrefs((s) => s.fontSize)
  const setFontSize = useEditorPrefs((s) => s.setFontSize)
  const uiFontWestern = useEditorPrefs((s) => s.uiFontWestern)
  const uiFontCjk = useEditorPrefs((s) => s.uiFontCjk)
  const setUiFont = useEditorPrefs((s) => s.setUiFont)
  const editorFontWestern = useEditorPrefs((s) => s.editorFontWestern)
  const editorFontCjk = useEditorPrefs((s) => s.editorFontCjk)
  const setEditorFont = useEditorPrefs((s) => s.setEditorFont)
  const foldEnabled = useEditorPrefs((s) => s.foldEnabled)
  const setFoldEnabled = useEditorPrefs((s) => s.setFoldEnabled)
  const syncScrollEnabled = useEditorPrefs((s) => s.syncScrollEnabled)
  const setSyncScrollEnabled = useEditorPrefs((s) => s.setSyncScrollEnabled)
  const lineWrapEnabled = useEditorPrefs((s) => s.lineWrapEnabled)
  const setLineWrapEnabled = useEditorPrefs((s) => s.setLineWrapEnabled)
  const imageMode = useEditorPrefs((s) => s.imageMode)
  const setImageMode = useEditorPrefs((s) => s.setImageMode)
  const assetsRoot = useEditorPrefs((s) => s.assetsRoot)
  const setAssetsRoot = useEditorPrefs((s) => s.setAssetsRoot)
  const themeList = useThemeStore((s) => s.themes)
  const themeActiveId = useThemeStore((s) => s.activeId)
  const setActiveTheme = useThemeStore((s) => s.setActive)
  const isDark = useAppearance((s) => s.isDark)
  const toggleDark = useAppearance((s) => s.toggleDark)
  const { isDesktop } = platformServices

  // 开机自启:仅桌面端有此能力。开关状态以系统注册表为准,
  // 抽屉打开时拉一次,不落本地状态(避免与真实状态漂移)
  const [autostartEnabled, setAutostartEnabled] = useState(false)
  useEffect(() => {
    if (!open || !isDesktop) return
    let alive = true
    void platformServices.autostart.isEnabled().then((v) => {
      if (alive) setAutostartEnabled(v)
    })
    return () => {
      alive = false
    }
  }, [open, isDesktop])
  const toggleAutostart = () => {
    const next = !autostartEnabled
    setAutostartEnabled(next) // 乐观更新,失败回滚
    void platformServices.autostart.setEnabled(next).catch(() => setAutostartEnabled(!next))
  }

  // 首次打开时控件挂载开销会与滑入动画同帧竞争(实测 256ms long task,动画掉帧);
  // 延迟到动画结束后再挂载表单主体,动画期只渲染骨架
  const [contentReady, setContentReady] = useState(false)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setContentReady(true), 240)
    return () => clearTimeout(t)
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 gap-0 overflow-y-auto sm:max-w-80">
        {/* 抽屉盖住顶栏后窗口拖拽区随之失效,头部补一块拖拽区:
            属性必须落在 mousedown 的实际目标上,所以 header 与标题都带 */}
        <SheetHeader
          data-tauri-drag-region
          className="flex-row items-center gap-2 shrink-0 border-b p-4"
        >
          {/* svg 的内部 path 会成为 mousedown 目标导致拖拽失效,
              pointer-events-none 让事件落到带 drag-region 的父级上 */}
          <Settings className="pointer-events-none size-4 text-muted-foreground" />
          <SheetTitle data-tauri-drag-region className="text-sm">设置</SheetTitle>
        </SheetHeader>
        {!contentReady ? (
          <div className="flex flex-col gap-4 px-4">
            <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
            <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
          </div>
        ) : (
        <div className="flex flex-col gap-6 px-4 pt-5 pb-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold">主题</h3>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">全局 MD 主题</span>
              <Select value={themeActiveId} onValueChange={setActiveTheme}>
                <SelectTrigger size="sm" className="w-[10.5rem]" aria-label="全局 MD 主题">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {listAllThemes({ themes: themeList, activeId: themeActiveId }).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">暗色模式</span>
              <Switch
                checked={isDark}
                onCheckedChange={toggleDark}
                aria-label="切换暗色模式"
              />
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">应用</h3>
            <FontPair
              western={uiFontWestern}
              cjk={uiFontCjk}
              onWestern={(v) => setUiFont(v, uiFontCjk)}
              onCjk={(v) => setUiFont(uiFontWestern, v)}
            />
            {/* 图片存储:桌面端可选本地文件夹(Web 无文件能力,锁定内嵌) */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">图片存储</span>
              <Select
                value={isDesktop ? imageMode : 'embedded'}
                onValueChange={(v) => setImageMode(v as 'assets' | 'embedded')}
                disabled={!isDesktop}
              >
                <SelectTrigger size="sm" className="w-[10.5rem]" aria-label="图片存储模式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assets">本地文件夹</SelectItem>
                  <SelectItem value="embedded">内嵌笔记</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isDesktop && imageMode === 'assets' && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="min-w-0 shrink-0 text-[13px] text-muted-foreground">图片目录</span>
                <div className="flex min-w-0 items-center gap-1">
                  <span
                    className="min-w-0 flex-1 truncate rounded-md bg-muted/50 px-2 py-1 text-right text-xs text-muted-foreground"
                    title={assetsRoot || '默认(应用数据目录)'}
                  >
                    {assetsRoot || '默认(应用数据目录)'}
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    title="打开图片目录"
                    onClick={() => {
                      void (async () => {
                        const dir = assetsRoot || (await platformServices.files.defaultAssetsRoot())
                        try {
                          // 打开前确保目录存在:首图未插时也能查看未来存放位置
                          await platformServices.files.writeBinaryFile(
                            `${dir.replace(/[\\/]+$/, '')}/.keep`,
                            new Uint8Array(),
                          )
                          await platformServices.files.openPath(dir)
                        } catch {
                          toast.error('打开目录失败')
                        }
                      })()
                    }}
                  >
                    打开
                  </Button>
                  {assetsRoot && (
                    <Button variant="ghost" size="xs" onClick={() => setAssetsRoot('')}>
                      恢复默认
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      void platformServices.files.pickDirectory().then((dir) => {
                        if (dir) setAssetsRoot(dir)
                      })
                    }}
                  >
                    更改
                  </Button>
                </div>
              </div>
            )}
            {isDesktop && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">开机自启</span>
                <Switch
                  checked={autostartEnabled}
                  onCheckedChange={toggleAutostart}
                  aria-label="切换开机自启"
                />
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold">编辑器</h3>
            <FontPair
              western={editorFontWestern}
              cjk={editorFontCjk}
              onWestern={(v) => setEditorFont(v, editorFontCjk)}
              onCjk={(v) => setEditorFont(editorFontWestern, v)}
              mono
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">字体大小</span>
              <div className="flex h-7 items-center overflow-hidden rounded-lg border">
                <button
                  type="button"
                  className="flex h-full items-center px-2 transition-colors hover:bg-accent disabled:opacity-40"
                  aria-label="减小编辑器字号"
                  disabled={fontSize <= EDITOR_FONT_RANGE.MIN}
                  onClick={() => setFontSize(fontSize - 0.5)}
                >
                  <Minus className="size-3.5" />
                </button>
                <span
                  className="min-w-10 border-x px-1 text-center text-xs leading-7 text-muted-foreground"
                  aria-live="polite"
                >
                  {fontSize}
                </span>
                <button
                  type="button"
                  className="flex h-full items-center px-2 transition-colors hover:bg-accent disabled:opacity-40"
                  aria-label="增大编辑器字号"
                  disabled={fontSize >= EDITOR_FONT_RANGE.MAX}
                  onClick={() => setFontSize(fontSize + 0.5)}
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">代码折叠箭头</span>
              <Switch
                checked={foldEnabled}
                onCheckedChange={setFoldEnabled}
                aria-label="切换代码折叠箭头"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">编辑/预览同步滚动</span>
              <Switch
                checked={syncScrollEnabled}
                onCheckedChange={setSyncScrollEnabled}
                aria-label="切换同步滚动"
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">自动换行</span>
              <Switch
                checked={lineWrapEnabled}
                onCheckedChange={setLineWrapEnabled}
                aria-label="切换自动换行"
              />
            </div>
          </section>
        </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
