import { useEffect, useMemo, useState } from 'react'

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
  useEditorPrefs,
} from '@/store-editor'
import {
  detectInstalledFonts,
  getCachedFullFontList,
  isLocalFontAccessSupported,
  requestAllFonts,
} from '@/lib/theme/font-list'
import { Minus, Plus } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

/**
 * 单个字体族选择:预设下拉(本机字体动态并入)+ 自定义输入(VSCode 式,
 * 可填任意族名或整段 font-family 值)。下拉选项用自身字体预览。
 */
function FontPicker({
  presets,
  value,
  onChange,
  placeholder,
  id,
}: {
  presets: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  id: string
}) {
  // 本机字体:上次授权的完整列表 > canvas 测量法常见字体探测
  const [localFonts, setLocalFonts] = useState<string[]>([])
  const [accessSupported, setAccessSupported] = useState(false)
  const [requesting, setRequesting] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setLocalFonts(getCachedFullFontList() ?? detectInstalledFonts())
      setAccessSupported(isLocalFontAccessSupported())
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const presetValues = useMemo(() => new Set(presets.map((p) => p.value)), [presets])
  const isKnown = presetValues.has(value) || localFonts.includes(value)

  const requestFullList = async () => {
    setRequesting(true)
    const list = await requestAllFonts()
    setRequesting(false)
    if (list) setLocalFonts(list)
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
          {presets
            .filter((p) => p.value !== '' || true)
            .map((p) => (
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
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs"
        style={{ fontFamily: value ? `'${value}', monospace` : undefined }}
      />
    </div>
  )
}

/** 字体对:西文 + 中文(浏览器按字符分流,西文不含汉字自动回落中文) */
function FontPair({
  label,
  hint,
  presets,
  western,
  cjk,
  onWestern,
  onCjk,
}: {
  label: string
  hint?: string
  presets: { label: string; value: string }[]
  western: string
  cjk: string
  onWestern: (v: string) => void
  onCjk: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <Label className="text-sm">{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">西文 / 代码</span>
          <FontPicker
            presets={presets}
            value={western}
            onChange={onWestern}
            placeholder="默认(跟随产品)"
            id={`${label}-western`}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">中文</span>
          <FontPicker
            presets={CJK_FONT_PRESETS}
            value={cjk}
            onChange={onCjk}
            placeholder="系统默认"
            id={`${label}-cjk`}
          />
        </div>
      </div>
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>设置</SheetTitle>
          <SheetDescription>应用偏好设置,实时生效并自动保存。</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">字体</h3>
            <FontPair
              label="产品界面"
              presets={UI_FONT_PRESETS}
              western={uiFontWestern}
              cjk={uiFontCjk}
              onWestern={(v) => setUiFont(v, uiFontCjk)}
              onCjk={(v) => setUiFont(uiFontWestern, v)}
            />
            <FontPair
              label="编辑器"
              hint="默认跟随界面"
              presets={MONO_FONT_PRESETS}
              western={editorFontWestern}
              cjk={editorFontCjk}
              onWestern={(v) => setEditorFont(v, editorFontCjk)}
              onCjk={(v) => setEditorFont(editorFontWestern, v)}
            />
          </section>

          <section>
            <h3 className="text-sm font-medium">编辑器</h3>
            <div className="mt-3 flex items-center justify-between">
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
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
