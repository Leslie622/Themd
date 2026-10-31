import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { memo, useEffect, useRef, useState } from 'react'
import {
  detectInstalledFonts,
  getCachedFullFontList,
  isLocalFontAccessSupported,
  requestAllFonts,
} from '@/lib/theme/font-list'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FieldDef } from '@/lib/theme/elements'
import { cn } from '@/lib/utils'

/**
 * 工场右栏的属性行：label + 类型控件 + ⟲ 恢复默认。
 * 「未设置」= 令牌不存在 = 回落基础样式表默认值。
 */
export const FieldRow = memo(function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  const set = (v: string) => onChange(v === '' ? undefined : v)
  const unset = () => onChange(undefined)

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Label className="w-24 shrink-0 text-xs text-muted-foreground">{field.label}</Label>
      <div className="min-w-0 flex-1">
        <FieldControl field={field} value={value} onChange={set} />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-6 shrink-0', value === undefined && 'invisible')}
        onClick={unset}
        aria-label={`重置${field.label}`}
        title="恢复默认"
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  )
})

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string | undefined
  onChange: (v: string) => void
}) {
  switch (field.type) {
    case 'color':
      return <ColorInput field={field} value={value} onChange={onChange} />
    case 'size':
      return <SizeInput value={value} onChange={onChange} unit={field.unit} placeholder={field.placeholder} />
    case 'number':
      return (
        <Input
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'font-weight':
      return (
        <Select value={value ?? ''} onValueChange={onChange}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder="未设置" />
          </SelectTrigger>
          <SelectContent position="popper">
            {['100', '200', '300', '400', '500', '600', '700', '800', '900'].map((w) => (
              <SelectItem key={w} value={w}>
                {w}{weightHint(w)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'font-family':
      return <FontFamilyInput value={value} onChange={onChange} />
    case 'select':
      return (
        <Select value={value ?? ''} onValueChange={onChange}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder="未设置" />
          </SelectTrigger>
          <SelectContent position="popper">
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case 'text-align':
      return (
        <Select value={value ?? ''} onValueChange={onChange}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder="未设置" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="start">左对齐</SelectItem>
            <SelectItem value="center">居中</SelectItem>
            <SelectItem value="justify">两端对齐</SelectItem>
          </SelectContent>
        </Select>
      )
    case 'text':
      return (
        <Input
          value={value ?? ''}
          placeholder={field.placeholder ?? '未设置'}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 text-xs"
        />
      )
  }
}

function weightHint(w: string) {
  const hints: Record<string, string> = {
    '100': ' 极细', '200': ' 特细', '300': ' 细', '400': ' 常规',
    '500': ' 中等', '600': ' 半粗', '700': ' 粗体', '800': ' 特粗', '900': ' 极粗',
  }
  return hints[w] ?? ''
}


/**
 * 颜色属性行(仅 color 类型用):传入 fallbackColor(未设置时的实际观感色,由父级从
 * 迷你预览测量)时,未设置的色块显示回落色并带斜角标识;否则显示通用棋盘格。
 */
export const ColorFieldRow = memo(function ColorFieldRow({
  field,
  value,
  fallbackColor,
  onChange,
  onLivePreview,
  onCommit,
}: {
  field: FieldDef
  value: string | undefined
  fallbackColor?: string
  onChange: (v: string | undefined) => void
  /** 拖动中的实时预览:直写预览容器 CSS 变量,零 React 渲染 */
  onLivePreview?: (field: FieldDef, v: string) => void
  /** 拖动结束后的最终提交(进 store 持久化) */
  onCommit?: (field: FieldDef, v: string) => void
}) {
  const set = (v: string) => onChange(v === '' ? undefined : v)
  const unset = () => onChange(undefined)

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Label className="w-24 shrink-0 text-xs text-muted-foreground">{field.label}</Label>
      <div className="min-w-0 flex-1">
        <ColorInput
          field={field}
          value={value}
          fallbackColor={fallbackColor}
          onChange={set}
          onLivePreview={onLivePreview}
          onCommit={onCommit}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-6 shrink-0', value === undefined && 'invisible')}
        onClick={unset}
        aria-label={`重置${field.label}`}
        title="恢复默认"
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  )
})

/**
 * 取色器 + hex 文本。「绝对流畅」拖动:
 * 拖动期间 onChange 只更新两处——取色器旁的色块(直接写 style)与预览容器的
 * CSS 变量(通过 onLivePreview 回调,零 React 渲染);store 提交由父级防抖收口。
 * 未设置时色块显示回落色预览(当前实际观感)。
 */
function ColorInput({
  value,
  field,
  fallbackColor,
  onChange,
  /** 拖动过程中的实时预览回调:直接改预览容器 CSS 变量,不经过 React */
  onLivePreview,
  /** 拖动结束(松手/停止 200ms)后的最终提交 */
  onCommit,
}: {
  value: string | undefined
  field: FieldDef
  fallbackColor?: string
  onChange: (v: string) => void
  onLivePreview?: (field: FieldDef, v: string) => void
  onCommit?: (field: FieldDef, v: string) => void
}) {
  // 非受控取色器:受控 value 会在提交延迟的一帧里被 React 回拉旧值,
  // 与用户拖动形成拔河(卡死根源)。用 ref 同步,只在「外部重置」时写回 DOM。
  const colorInputRef = useRef<HTMLInputElement>(null)
  const safe = value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#000000'
  // 色块本地实时色:拖动期间直接写 DOM,不进 React state
  const swatchRef = useRef<HTMLSpanElement>(null)
  // 始终持有最新回调(effect 内同步,避免渲染期写 ref)
  const cbRef = useRef({ onChange, onLivePreview, onCommit, field })
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    cbRef.current = { onChange, onLivePreview, onCommit, field }
    onChangeRef.current = onChange
  })

  const frame = useRef(0)
  const pendingValue = useRef<string | null>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const submitThrottled = (v: string) => {
    pendingValue.current = v
    // 实时路径:色块 + 预览容器 CSS 变量,同步直写,无 React 参与
    if (swatchRef.current) swatchRef.current.style.background = v
    cbRef.current.onLivePreview?.(cbRef.current.field, v)
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      // store 提交仍按帧合拢(拖动中每帧至多一次,保证中栏大预览跟手)
      if (pendingValue.current !== null) {
        onChangeRef.current(pendingValue.current)
      }
    })
    // 最终提交:停止拖动 200ms 后收口(松手或悬停停顿)
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => {
      if (pendingValue.current !== null) {
        cbRef.current.onCommit?.(cbRef.current.field, pendingValue.current)
      }
    }, 200)
  }
  // 卸载时若还有未提交的值,立即提交(避免松手瞬间丢最后一次)
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      if (commitTimer.current) clearTimeout(commitTimer.current)
      if (pendingValue.current !== null) onChangeRef.current(pendingValue.current)
    },
    [],
  )
  // 外部值变化(重置/切主题/切明暗套)时同步取色器显示;用户拖动中不回写
  useEffect(() => {
    if (colorInputRef.current && pendingValue.current === null) {
      colorInputRef.current.value = safe
    }
  }, [safe])

  // 色块显示:已设置→该色;未设置→回落色(若可测),否则棋盘格
  const swatchStyle: React.CSSProperties = value
    ? { background: value }
    : fallbackColor
      ? { background: fallbackColor }
      : {
          background:
            'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%), linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%) 4px 4px / 8px 8px, white',
        }

  return (
    <div className="flex items-center gap-1.5">
      <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border">
        <span ref={swatchRef} className="absolute inset-0" style={swatchStyle} />
        {/* 未设置但有回落色:右下角小斜角标识,区分「已固定」与「跟随回落」 */}
        {!value && fallbackColor && (
          <span
            aria-hidden
            className="absolute right-0 bottom-0 size-2.5 border-t border-l border-border bg-background/85"
          />
        )}
        <input
          ref={colorInputRef}
          type="color"
          defaultValue={safe}
          onChange={(e) => submitThrottled(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="取色器"
        />
      </label>
      <Input
        value={value ?? ''}
        placeholder={fallbackColor ? `未设置 · 当前 ${fallbackColor}` : '未设置'}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 font-mono text-xs"
      />
    </div>
  )
}

/** 数字 + 单位。存值约定：带单位字符串（'16px' / '1.25em'），纯数字按默认单位补 */
function SizeInput({
  value,
  onChange,
  unit = 'px',
  placeholder,
}: {
  value: string | undefined
  onChange: (v: string) => void
  unit?: string
  placeholder?: string
}) {
  const m = value?.match(/^(-?[\d.]+)([a-z%]*)$/i)
  const num = m?.[1] ?? ''
  const curUnit = m?.[2] || unit
  const emit = (n: string, u: string) => onChange(n === '' ? '' : `${n}${u}`)
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        inputMode="decimal"
        value={num}
        placeholder={placeholder}
        onChange={(e) => emit(e.target.value, curUnit)}
        className="h-8 min-w-0 flex-1 text-xs"
      />
      <Select value={curUnit} onValueChange={(u) => emit(num || '0', u)}>
        <SelectTrigger size="sm" className="w-16 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {['px', 'em', 'rem', '%'].map((u) => (
            <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

const FONT_PRESETS = [
  { label: 'Geist（默认无衬线）', value: "'Geist Variable', sans-serif" },
  { label: '系统界面字体', value: 'system-ui, sans-serif' },
  { label: '宋体（衬线）', value: "'Songti SC', 'SimSun', serif" },
  { label: '楷体', value: "'Kaiti SC', 'KaiTi', serif" },
  { label: '黑体', value: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: '等宽', value: "ui-monospace, Consolas, monospace" },
]

/**
 * 字体选择:预设下拉 + 本机字体(挂载时自动用 canvas 测量法探测,约 70ms,结果缓存)
 * + 任意值自定义输入。浏览器安全模型不允许静默枚举全部已装字体,
 * 测量法覆盖常见中西文与编程字体;字体列表逐项用自身字体渲染预览。
 */
function FontFamilyInput({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  const isPreset = FONT_PRESETS.some((f) => f.value === value)
  // 字体来源优先级:上次授权的完整列表(Local Font Access)> canvas 测量法(常见字体探测)
  const [localFonts, setLocalFonts] = useState<string[] | null>(null)
  const [accessSupported, setAccessSupported] = useState(false)
  const [requesting, setRequesting] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      setLocalFonts(getCachedFullFontList() ?? detectInstalledFonts())
      setAccessSupported(isLocalFontAccessSupported())
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const requestFullList = async () => {
    setRequesting(true)
    const result = await requestAllFonts()
    setRequesting(false)
    if (result.ok) {
      setLocalFonts(result.fonts)
    } else if (result.reason === 'denied') {
      toast.error('字体访问权限被拒绝', {
        description:
          '请点地址栏左侧的图标 → 权限 → 字体,改为「允许」后重试。',
        duration: 10000,
      })
    } else {
      toast.error('读取字体列表失败，请重试')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={
          isPreset || !value
            ? (value ?? 'custom')
            : localFonts?.some((f) => value.includes(`'${f}'`))
              ? value
              : 'custom'
        }
        onValueChange={(v) => {
          if (v !== 'custom') onChange(v)
        }}
      >
        <SelectTrigger size="sm" className="w-32 shrink-0">
          <SelectValue placeholder="自定义" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">预设组合</div>
          {FONT_PRESETS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
          {localFonts && localFonts.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-1 border-t px-2 py-1">
                <span className="text-xs font-medium text-muted-foreground">
                  本机字体（{localFonts.length}）
                </span>
                {accessSupported && (
                  <button
                    type="button"
                    disabled={requesting}
                    onClick={() => void requestFullList()}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                    title="通过浏览器授权读取全部已安装字体(含你自行安装的)"
                  >
                    {requesting ? '读取中…' : '获取完整列表'}
                  </button>
                )}
              </div>
              {localFonts.map((f) => (
                <SelectItem key={f} value={`'${f}'`}>
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
        value={value ?? ''}
        placeholder="font-family 值"
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 flex-1 font-mono text-xs"
      />
    </div>
  )
}