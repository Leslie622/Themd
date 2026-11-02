import { ImagePlus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { memo, useEffect, useRef, useState } from 'react'
import { FontField } from '@/components/settings/FontField'
import { useLocalFontList } from '@/components/settings/use-local-font-list'
import { platformServices } from '@/app/platform'
import { fileFromBytes, fileToBackgroundValue } from '@/lib/image'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FieldDef } from '@/lib/theme/elements'
import { cn } from '@/lib/utils'

/**
 * 工场右栏的属性行：label + 类型控件 + ⟲ 恢复默认。
 * 「未设置」= 令牌不存在 = 回落基础样式表默认值。
 */
export const FieldRow = memo(function FieldRow({
  field,
  value,
  fallbackFont,
  onChange,
}: {
  field: FieldDef
  value: string | undefined
  /** 字体令牌的回落字体(实测);其他类型忽略 */
  fallbackFont?: string
  onChange: (v: string | undefined) => void
}) {
  const set = (v: string) => onChange(v === '' ? undefined : v)
  const unset = () => onChange(undefined)

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Label className="w-20 shrink-0 text-xs text-muted-foreground">{field.label}</Label>
      <div className="min-w-0 flex-1">
        {/* key 按字段隔离:SizeInput 记单位的 ref 不能跨字段残留 */}
        <FieldControl key={field.key} field={field} value={value} fallbackFont={fallbackFont} onChange={set} />
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
  fallbackFont,
  onChange,
}: {
  field: FieldDef
  value: string | undefined
  fallbackFont?: string
  onChange: (v: string) => void
}) {
  switch (field.type) {
    case 'color':
      return <ColorInput field={field} value={value} onChange={onChange} />
    case 'background':
      return <BackgroundInput value={value} onChange={onChange} />
    case 'size':
      return <SizeInput value={value} onChange={onChange} unit={field.unit} placeholder={field.placeholder} />
    case 'box':
      return <BoxInput value={value} onChange={onChange} unit={field.unit} placeholder={field.placeholder} />
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
          <SelectContent>
            <SelectGroup>
            {['100', '200', '300', '400', '500', '600', '700', '800', '900'].map((w) => (
                <SelectItem key={w} value={w}>
                {w}{weightHint(w)}
              </SelectItem>
            ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )
    case 'font-family':
      return <FontFamilyInput field={field} value={value} fallbackFamily={fallbackFont} onChange={onChange} />
    case 'select':
      return (
        <Select value={value ?? ''} onValueChange={onChange}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder="未设置" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
            {(field.options ?? []).map((o) => (
                <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )
    case 'text-align':
      return (
        <Select value={value ?? ''} onValueChange={onChange}>
          <SelectTrigger className="w-full" size="sm">
            <SelectValue placeholder="未设置" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="start">左对齐</SelectItem>
              <SelectItem value="center">居中</SelectItem>
              <SelectItem value="justify">两端对齐</SelectItem>
            </SelectGroup>
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
      <Label className="w-20 shrink-0 text-xs text-muted-foreground">{field.label}</Label>
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

  // 色块显示:已设置→该色;未设置→回落色(若可测),否则透明棋盘格
  const swatchStyle: React.CSSProperties = value
    ? { background: value }
    : fallbackColor
      ? { background: fallbackColor }
      : { background: TRANSPARENT_SWATCH }

  // 未设置但测到回落色:输入框直接回显当前生效的色值(灰斜体 = 继承,非自设),
  // 输入/取色即覆盖,清空回到回显——比「未设置 · 当前 …」占位符直观
  const echoed = !value && fallbackColor ? fallbackColor : undefined

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
        value={value ?? echoed ?? ''}
        placeholder={fallbackColor ? `未设置 · 当前 ${fallbackColor}` : '未设置'}
        onChange={(e) => onChange(e.target.value)}
        className={cn('h-8 font-mono text-xs', echoed && 'text-muted-foreground italic')}
        title={echoed ? '未设置,显示当前生效的回落色;输入或取色即可覆盖' : undefined}
      />
    </div>
  )
}

/** 未设置色板的「透明」标识:标准 crisp 棋盘格(国际通用的透明符号) */
const TRANSPARENT_SWATCH = 'repeating-conic-gradient(#dcdcdc 0% 25%, #ffffff 0% 50%) 0 0 / 8px 8px'

/**
 * 画布背景控件:值 = 完整 CSS background(颜色/渐变/图片),由预览滚动容器
 * 以 background 原样消费。色块 + hex 覆盖最常用的纯色;「图片…」把本机图片
 * 压成 data URL 内嵌进主题值(主题要可分享可导出,不能引用本机路径);
 * 自由文本承接渐变、多背景等高级写法。
 */
function BackgroundInput({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  const [picking, setPicking] = useState(false)
  const hasImage = value?.includes('url(') ?? false
  // 色块即预览:颜色/图片都是 background 值,直接渲染到色块上;未设置 = 透明棋盘格
  const swatchStyle: React.CSSProperties = value ? { background: value } : { background: TRANSPARENT_SWATCH }
  // 非受控取色器:只在纯色/未设置态显示,外部重置时同步回显
  const colorInputRef = useRef<HTMLInputElement>(null)
  const safe = value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#ffffff'
  useEffect(() => {
    if (colorInputRef.current && !hasImage) colorInputRef.current.value = safe
  }, [safe, hasImage])

  const pickImage = async () => {
    setPicking(true)
    try {
      const picked = await platformServices.files.pickImageFile()
      if (!picked) return
      const bytes = await platformServices.files.readBinaryFile(picked.path)
      // fileFromBytes 按扩展名补 MIME(裸 File 的 type 为空会被图片守卫误拒);
      // fileToBackgroundValue 自动判定:大图 cover、小图平铺
      onChange(await fileToBackgroundValue(fileFromBytes(bytes, picked.name)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '读取图片失败')
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <label className="relative size-8 shrink-0 overflow-hidden rounded-md border">
        <span className="absolute inset-0" style={swatchStyle} />
        {/* 图片态不叠取色器:点色块换色会静默丢掉图片,换色走清空后重设 */}
        {!hasImage && (
          <input
            ref={colorInputRef}
            type="color"
            defaultValue={safe}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="画布背景取色器"
          />
        )}
      </label>
      <Input
        value={value ?? ''}
        placeholder="未设置"
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 flex-1"
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        disabled={picking}
        onClick={() => void pickImage()}
        title="插入背景图片"
        aria-label="插入背景图片"
      >
        <ImagePlus className="size-4" />
      </Button>
    </div>
  )
}

/**
 * 四边盒值:2×2 网格 + 常显方位小标签(上/左、下/右),不需要 hover 识别;
 * 共享单位选择器放右侧。存值仍是 CSS 简写字符串('0.2em' / '0.2em 0.35em' /
 * '1px 2px 3px 4px'),导出/导入/持久化链路无需感知 UI 形态;全边一致时收拢
 * 为单值,保持令牌最简。手写令牌里的多单位简写(如 '0.2em 4px')也能解析。
 */
function BoxInput({
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
  // 简写 → 四边 [数值, 单位]:1 值四边同用;2 值=上下|左右;4 值=上右下左;3 值/含非数字 = 不展示(保持占位)
  const parse = (v: string | undefined): [string, string][] | null => {
    const parts = (v ?? '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return null
    if (parts.some((p) => !/^(-?[\d.]+)([a-z%]*)$/i.test(p))) return null
    const side = (p: string): [string, string] => {
      const m = p.match(/^(-?[\d.]+)([a-z%]*)$/i)!
      return [m[1], m[2] || unit]
    }
    if (parts.length === 1) { const s = side(parts[0]); return [s, s, s, s] }
    if (parts.length === 2) { const v = side(parts[0]); const h = side(parts[1]); return [v, h, v, h] }
    if (parts.length === 4) return parts.map(side)
    return null
  }
  const sides = parse(value)
  const [lastUnit, setLastUnit] = useState<string | null>(null)
  // 共享单位:优先取四边中第一个带单位的;无值时用上次选择,再回落字段默认
  const curUnit = sides?.[0]?.[1] || lastUnit || unit
  const base = sides ?? Array.from({ length: 4 }, () => ['', curUnit] as [string, string])
  const emit = (i: number, n: string) => {
    emitSides(base.map((s, j) => (j === i ? ([n, curUnit] as [string, string]) : s)))
  }
  const emitSides = (raw: [string, string][]) => {
    // 空边回落 0(首次输入时其余三格还是空串);全空 = 删令牌
    const norm = raw.map((s) => (s[0] === '' ? (['0', curUnit] as [string, string]) : s))
    if (norm.every((s) => s[0] === '0')) { onChange(''); return }
    // 四边数值一致(含单位)时收拢单值,否则按 上 右 下 左 简写
    if (norm.every((s) => s[0] === norm[0][0] && s[1] === norm[0][1])) {
      setLastUnit(norm[0][1])
      onChange(`${norm[0][0]}${norm[0][1]}`)
      return
    }
    const [t, r, b, l] = norm
    // 上下相等且左右相等 → 2 值简写
    if (t[0] === b[0] && t[1] === b[1] && r[0] === l[0] && r[1] === l[1]) {
      setLastUnit(t[1])
      onChange(`${t[0]}${t[1]} ${r[0]}${r[1]}`)
      return
    }
    setLastUnit(t[1])
    onChange(norm.map((s) => `${s[0]}${s[1]}`).join(' '))
  }
  const cell = (i: number) => (
    <label className="flex min-w-0 flex-1 items-center gap-1">
      <span className="w-3 shrink-0 text-center text-[10px] text-muted-foreground">{['上', '右', '下', '左'][i]}</span>
      <Input
        type="number"
        inputMode="decimal"
        value={base[i][0]}
        placeholder={placeholder}
        aria-label={['上', '右', '下', '左'][i]}
        onChange={(e) => emit(i, e.target.value)}
        className="h-7 min-w-0 flex-1 px-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  )
  return (
    <div className="flex items-center gap-1">
      {/* 单行四格(上右下左)均分整行宽度:Figma 式 padding 编辑器,不剩右侧空白,
          与相邻控件保持同一行节奏;10px 常显方位标签免 hover,隐藏 spinner 降视觉噪音 */}
      {cell(0)}
      {cell(1)}
      {cell(2)}
      {cell(3)}
      <Select
        value={curUnit}
        onValueChange={(u) => {
          setLastUnit(u)
          emitSides(base.map((s) => [s[0], u] as [string, string]))
        }}
      >
        <SelectTrigger size="sm" className="w-12 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {['px', 'em', 'rem', '%'].map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
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
  // 记住最近一次生效的单位:输入框清空的瞬间令牌被删(value=undefined),
  // 若直接回落字段默认单位,「选 px 再输入数字」会被吞成默认单位(如 em)
  const [lastUnit, setLastUnit] = useState<string | null>(null)
  const curUnit = m?.[2] || lastUnit || unit
  const emit = (n: string, u: string) => {
    if (n !== '') setLastUnit(u)
    onChange(n === '' ? '' : `${n}${u}`)
  }
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
      <Select
        value={curUnit}
        onValueChange={(u) => emit(num || '0', u)}
      >
        <SelectTrigger size="sm" className="w-16 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
          {['px', 'em', 'rem', '%'].map((u) => (
              <SelectItem key={u} value={u}>
              {u}
            </SelectItem>
          ))}
          </SelectGroup>
          </SelectContent>
      </Select>
    </div>
  )
}

/**
 * 字体选择:直接复用设置模块的 FontField(逻辑与设置抽屉一致)——
 * 触发器回显当前值,点击打开完整本机字体弹窗(搜索/逐行复制/底部自由输入,
 * 支持逗号分隔多族名的 font-family 语义),不再是下拉框。
 * 代码类令牌(inlineCode/codeBlock)用等宽语境预览字体。
 */
function FontFamilyInput({
  field,
  value,
  fallbackFamily,
  onChange,
}: {
  field: FieldDef
  value: string | undefined
  /** 未设置时实际生效的字体族(从预览实测);标题继承正文、正文回落基础样式 */
  fallbackFamily?: string
  onChange: (v: string) => void
}) {
  const { fonts } = useLocalFontList()
  const mono = field.key === 'inlineCode.font' || field.key === 'codeBlock.font'
  // 回显语义:标题各级跟「标题（共用）」走,共用跟正文走,其余跟随基础样式表默认
  const followPrefix = /^h[1-6]\.font$/.test(field.key)
    ? '跟随标题'
    : field.key === 'heading.font'
      ? '跟随正文'
      : '跟随默认'
  const echo = !value && fallbackFamily ? `${followPrefix} · ${fallbackFamily}` : undefined
  return (
    <FontField
      label=""
      value={value ?? ''}
      onChange={onChange}
      placeholder="未设置"
      mono={mono}
      fonts={fonts}
      echo={echo}
    />
  )
}