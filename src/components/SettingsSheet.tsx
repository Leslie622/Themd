import { useEffect, useMemo, useState } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CJK_FONT_PRESETS,
  EDITOR_FONT_RANGE,
  MONO_FONT_PRESETS,
  UI_FONT_PRESETS,
  buildFontStack,
  useEditorPrefs,
} from '@/store-editor'
import {
  detectInstalledFonts,
  getCachedFullFontList,
  isLocalFontAccessSupported,
  requestAllFonts,
} from '@/lib/theme/font-list'
import { Minus, Plus } from 'lucide-react'

/** 预览样例:中西文与代码混排,换字体立刻可感知 */
const SAMPLE_TEXT = '笔记 Aa1 — 字体预览 {code: true}'
const SAMPLE_CJK = '笔记字体预览'
const SAMPLE_LATIN = 'Aa Bb 012'

let fontListPromise: Promise<string[]> | null = null
/** 全局共享的本机字体列表:首个 picker 触发,其余复用;idle 后跑,不阻塞抽屉动画 */
function loadLocalFonts(): Promise<string[]> {
  if (!fontListPromise) {
    fontListPromise = new Promise<string[]>((resolve) => {
      const cached = getCachedFullFontList()
      if (cached) return resolve(cached)
      const run = () => resolve(detectInstalledFonts())
      if ('requestIdleCallback' in window) {
        ;(window as never as { requestIdleCallback(cb: () => void): void }).requestIdleCallback(run)
      } else {
        setTimeout(run, 400)
      }
    })
  }
  return fontListPromise
}

/**
 * 单个字体族选择:预设下拉(本机字体动态并入)+ 自定义输入(VSCode 式,
 * 可填任意族名)。下拉选项用自身字体预览。
 */
function FontPicker({
  presets,
  value,
  onChange,
  placeholder,
  sample,
}: {
  presets: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  sample: string
}) {
  const [localFonts, setLocalFonts] = useState<string[]>([])
  const [accessSupported, setAccessSupported] = useState(false)
  const [requesting, setRequesting] = useState(false)
  useEffect(() => {
    let alive = true
    void loadLocalFonts().then((list) => {
      if (alive) setLocalFonts(list)
    })
    // isLocalFontAccessSupported 只读一次性能力探测,微任务延迟以满足 lint
    Promise.resolve().then(() => {
      if (alive) setAccessSupported(isLocalFontAccessSupported())
    })
    return () => {
      alive = false
    }
  }, [])

  const presetValues = useMemo(() => new Set(presets.map((p) => p.value)), [presets])
  const isKnown = presetValues.has(value) || localFonts.includes(value)

  const requestFullList = async () => {
    setRequesting(true)
    const list = await requestAllFonts()
    setRequesting(false)
    if (list) {
      fontListPromise = Promise.resolve(list)
      setLocalFonts(list)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={isKnown ? value : 'custom'}
        onValueChange={(v) => {
          if (v !== 'custom') onChange(v)
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-label={placeholder}>
          <SelectValue placeholder="自定义" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {presets.map((p) => (
            <SelectItem key={p.label} value={p.value}>
              <span style={{ fontFamily: p.value ? `'${p.value}', sans-serif` : undefined }}>
                {p.label}
              </span>
            </SelectItem>
          ))}
          {localFonts.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-1 border-t px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">
                  本机字体({localFonts.length})
                </span>
                {accessSupported && (
                  <button
                    type="button"
                    disabled={requesting}
                    onClick={() => void requestFullList()}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    {requesting ? '读取中…' : '获取完整列表'}
                  </button>
                )}
              </div>
              {localFonts.map((f) => (
                <SelectItem key={f} value={f}>
                  <span className="truncate" style={{ fontFamily: `'${f}', monospace` }}>
                    {f}
                  </span>
                </SelectItem>
              ))}
            </>
          )}
          <SelectItem value="custom">自定义…</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs"
      />
      <p
        className="truncate rounded-md bg-muted/50 px-2 py-1 text-xs text-muted-foreground"
        style={{ fontFamily: value ? `'${value}', sans-serif` : undefined }}
        title={sample}
      >
        {sample}
      </p>
    </div>
  )
}

/** 设置分区:标题 + 描述 + 内容的卡片分组 */
function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border bg-card p-3">
      <div className="mb-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

/** 字体对:西文 + 中文(浏览器按字符分流),底部整行实时预览 */
function FontPair({
  presets,
  western,
  cjk,
  onWestern,
  onCjk,
  fallback,
}: {
  presets: { label: string; value: string }[]
  western: string
  cjk: string
  onWestern: (v: string) => void
  onCjk: (v: string) => void
  fallback: string
}) {
  const stack = western.trim() || cjk.trim() ? buildFontStack(western, cjk, fallback) : undefined
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">西文</Label>
          <FontPicker
            presets={presets}
            value={western}
            onChange={onWestern}
            placeholder="默认"
            sample={SAMPLE_LATIN}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">中文</Label>
          <FontPicker
            presets={CJK_FONT_PRESETS}
            value={cjk}
            onChange={onCjk}
            placeholder="系统默认"
            sample={SAMPLE_CJK}
          />
        </div>
      </div>
      <p
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
        style={stack ? { fontFamily: stack } : undefined}
      >
        {SAMPLE_TEXT}
      </p>
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

  // 首次打开时 4 个 Select + 8 个控件的挂载开销会与滑入动画同帧竞争(实测
  // 256ms long task,动画掉帧);延迟到动画结束后再挂载表单主体,动画期只渲染骨架
  const [contentReady, setContentReady] = useState(false)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setContentReady(true), 240)
    return () => clearTimeout(t)
  }, [open])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 gap-0 overflow-y-auto sm:max-w-80">
        <SheetHeader>
          <SheetTitle>设置</SheetTitle>
          <SheetDescription>实时生效并自动保存。</SheetDescription>
        </SheetHeader>
        {!contentReady ? (
          <div className="flex flex-col gap-4 px-4">
            <div className="h-40 animate-pulse rounded-xl bg-muted/60" />
            <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
          </div>
        ) : (
        <div className="flex flex-col gap-3 px-4 pb-6">
          <Section
            title="字体"
            description="西文与中文分开设置;汉字自动落到中文字体。"
          >
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">产品界面</span>
              <FontPair
                presets={UI_FONT_PRESETS}
                western={uiFontWestern}
                cjk={uiFontCjk}
                onWestern={(v) => setUiFont(v, uiFontCjk)}
                onCjk={(v) => setUiFont(uiFontWestern, v)}
                fallback="sans-serif"
              />
            </div>
            <div className="border-t" />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">编辑器</span>
              <FontPair
                presets={MONO_FONT_PRESETS}
                western={editorFontWestern}
                cjk={editorFontCjk}
                onWestern={(v) => setEditorFont(v, editorFontCjk)}
                onCjk={(v) => setEditorFont(editorFontWestern, v)}
                fallback="monospace"
              />
            </div>
          </Section>

          <Section title="编辑器" description="代码编辑区的显示字号。">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">字体大小</span>
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
          </Section>
        </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
