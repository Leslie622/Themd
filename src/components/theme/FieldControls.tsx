import { IconPhotoPlus, IconRotate2 } from '@tabler/icons-react'
import { hexToHsva, hsvaToHex, hsvaToRgba, rgbaToHsva, type HsvaColor } from '@uiw/color-convert'
import Saturation from '@uiw/react-color-saturation'
import Hue from '@uiw/react-color-hue'
import Alpha from '@uiw/react-color-alpha'
import Swatch from '@uiw/react-color-swatch'
import { toast } from 'sonner'
import { memo, useEffect, useRef, useState } from 'react'
import { FontField } from '@/components/settings/FontField'
import { useLocalFontList } from '@/components/settings/use-local-font-list'
import { Tip } from '@/components/Tip'
import { platformServices } from '@/app/platform'
import { fileFromBytes, fileToBackgroundValue } from '@/lib/image'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { FieldDef } from '@/lib/theme/elements'
import { placeholderOf } from '@/lib/theme/elements'
import { cssColorToRgba, oklchToRgba } from '@/lib/theme/css-color'
import { cn } from '@/lib/utils'

/**
 * 工场右栏的属性行：label + 类型控件 + ⟲ 恢复默认。
 * 「未设置」= 令牌不存在 = 回落基础样式表默认值。
 */
export const FieldRow = memo(function FieldRow({
  field,
  value,
  fallbackColor,
  fallbackFont,
  onChange,
  onLivePreview,
  onCommit,
}: {
  field: FieldDef
  value: string | undefined
  /** 颜色令牌的回落色(实测);其他类型忽略 */
  fallbackColor?: string
  /** 字体令牌的回落字体(实测);其他类型忽略 */
  fallbackFont?: string
  onChange: (v: string | undefined) => void
  /** 拖动实时预览/收口提交:颜色与 background 类使用(零渲染直写预览) */
  onLivePreview?: (field: FieldDef, v: string) => void
  onCommit?: (field: FieldDef, v: string) => void
}) {
  const set = (v: string) => onChange(v === '' ? undefined : v)
  const unset = () => onChange(undefined)

  return (
    <div className="flex items-start gap-2 py-1.5">
      {/* items-start + leading 对齐控件本体高度:有描述时 label 仍与控件第一行对齐,
          描述悬在控件下方不参与垂直居中 */}
      <Label className="w-20 shrink-0 pt-[10px] text-xs leading-none text-muted-foreground">{field.label}</Label>
      <div className="min-w-0 flex-1">
        {/* key 按字段隔离:SizeInput 记单位的 ref 不能跨字段残留 */}
        <FieldControl
          key={field.key}
          field={field}
          value={value}
          fallbackColor={fallbackColor}
          fallbackFont={fallbackFont}
          onChange={set}
          onLivePreview={onLivePreview}
          onCommit={onCommit}
        />
        <FieldHint hint={field.hint} />
      </div>
      <Tip label="恢复默认" side="bottom">
        <Button
          variant="ghost"
          size="icon"
          className={cn('mt-0.5 size-7 shrink-0', value === undefined && 'invisible')}
          onClick={unset}
          aria-label={`重置${field.section ?? ""}${field.label}`}
        >
          <IconRotate2 className="size-4" />
        </Button>
      </Tip>
    </div>
  )
})

function FieldControl({
  field,
  value,
  fallbackColor,
  fallbackFont,
  onChange,
  onLivePreview,
  onCommit,
}: {
  field: FieldDef
  value: string | undefined
  fallbackColor?: string
  fallbackFont?: string
  onChange: (v: string) => void
  onLivePreview?: (field: FieldDef, v: string) => void
  onCommit?: (field: FieldDef, v: string) => void
}) {
  // 占位符 = 令牌在基础样式表的真实回落值,统一从常表查(defaults.ts,
  // 守门测试锁定与 CSS 一致);颜色/字体类查不到,控件内部走运行时实测
  const placeholder = placeholderOf(field.key)
  switch (field.type) {
    case 'color':
      return (
        <ColorInput
          field={field}
          value={value}
          fallbackColor={fallbackColor}
          onChange={onChange}
          onLivePreview={onLivePreview}
          onCommit={onCommit}
        />
      )
    case 'background':
      return (
        <BackgroundInput
          field={field}
          value={value}
          onChange={onChange}
          onLivePreview={onLivePreview}
          onCommit={onCommit}
        />
      )
    case 'percent':
      return <PercentInput value={value} onChange={onChange} placeholder={placeholder} />
    case 'size':
      return <SizeInput value={value} onChange={onChange} unit={field.unit} placeholder={placeholder} />
    case 'box':
      return <BoxInput value={value} onChange={onChange} unit={field.unit} placeholder={placeholder} />
    case 'number':
      return (
        <NumberCell
          value={value ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          className="h-8 text-xs"
          step={field.step}
          min={field.min}
          max={field.max}
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
          <Tip label={!value && field.defaultLabel ? '未设置,跟随基础样式表默认;选择即覆盖' : undefined}>
            <SelectTrigger
              className={cn('w-full', !value && field.defaultLabel && 'text-muted-foreground italic')}
              size="sm"
            >
              {/* 未设置有默认值时回显默认值本身(灰斜体=非自设,来源语义在 tooltip) */}
              <SelectValue placeholder={field.defaultLabel ?? '未设置'} />
            </SelectTrigger>
          </Tip>
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
    case 'marker-text':
      return <MarkerTextInput value={value} placeholder={placeholder} onChange={onChange} />
    case 'marker-template':
      return <MarkerTemplateInput value={value} onChange={onChange} />
    case 'shadow':
      return <ShadowInput field={field} value={value} onChange={onChange} />
  }
}

/**
 * 盒阴影输入:X/Y 偏移、模糊、扩散四个数值格(2×2,同 BoxInput) + 颜色取色器。
 * 存值 = 完整 box-shadow 值('4px 4px 8px 0px rgba(0,0,0,0.3)'),导出/导入/持久化
 * 对控件零感知;四格全空/零 = 删令牌(none)。手写令牌按「长度 长度 长度? 长度?
 * 颜色」解析,解析不了时不回显(值仍保留,直到用户重新编辑)。
 */
function ShadowInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string | undefined
  onChange: (v: string) => void
}) {
  // 解析 box-shadow 值 → [x, y, blur, spread, color]:4 长度 + 尾部颜色;
  // 2~3 个长度(模糊/扩散可省)也接受,缺省位补 0
  const parse = (v: string | undefined): [string, string, string, string, string] | null => {
    const s = (v ?? '').trim()
    if (!s || s === 'none') return null
    const m = /^(-?[\d.]+[a-z%]*)\s+(-?[\d.]+[a-z%]*)(?:\s+(-?[\d.]+[a-z%]*))?(?:\s+(-?[\d.]+[a-z%]*))?\s+(.+)$/i.exec(s)
    if (!m) return null
    const len = (raw: string | undefined, def: string) =>
      raw === undefined ? def : (raw.match(/^(-?[\d.]+)([a-z%]*)$/i)?.[2] ? raw : `${raw}px`)
    return [len(m[1], '0px'), len(m[2], '0px'), len(m[3], '0px'), len(m[4], '0px'), m[5].trim()]
  }
  const parsed = parse(value)
  const nums = parsed?.slice(0, 4) ?? ['', '', '', '']
  const color = parsed?.[4] ?? ''
  const emit = (nextNums: string[], nextColor: string) => {
    if (nextNums.every((n) => n === '' || parseFloat(n) === 0)) {
      onChange('') // 全零/全空 = 无阴影
      return
    }
    const px = (n: string) => (n === '' ? '0px' : /^-?[\d.]+$/.test(n) ? `${n}px` : n)
    onChange(`${px(nextNums[0])} ${px(nextNums[1])} ${px(nextNums[2])} ${px(nextNums[3])} ${nextColor || 'currentColor'}`)
  }
  const cell = (i: number, labelText: string) => (
    <label className="flex min-w-0 flex-1 items-center gap-1">
      <span className="w-3 shrink-0 text-center text-[10px] text-muted-foreground">{labelText}</span>
      <NumberCell
        value={nums[i]}
        placeholder="0"
        ariaLabel={['X 偏移', 'Y 偏移', '模糊', '扩散'][i]}
        onChange={(n) => {
          const next = [...nums]
          next[i] = n
          emit(next, color)
        }}
        className="h-7 min-w-0 flex-1 px-1 text-center text-xs"
      />
    </label>
  )
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="grid grid-cols-2 gap-1">
        {cell(0, 'X')}
        {cell(1, 'Y')}
        {cell(2, '糊')}
        {cell(3, '散')}
      </div>
      {/* 颜色行复用 ColorInput(与其他颜色字段同款取色器/hex 输入);
          无回落色实测,未设置时显示棋盘格 + 「未设置」占位 */}
      <ColorInput
        field={field}
        value={color || undefined}
        onChange={(v) => emit(nums, v)}
      />
    </div>
  )
}

/**
 * 列表自定义符号输入:用户输裸符号(▸、★、emoji…),存储层要的是合法 CSS content
 * 字符串——提交时包引号 + 尾随空格(与正文的间隔),回显时剥掉;空值 = 删令牌回落 normal。
 * 引号在符号里非法(CSS 字符串定界符),输入时静默剔除。
 */
function MarkerTextInput({
  value,
  placeholder,
  onChange,
}: {
  value: string | undefined
  placeholder?: string
  onChange: (v: string) => void
}) {
  const display = (value ?? '').replace(/^"(.*)"$/s, '$1').replace(/ $/, '')
  const commit = (raw: string) => {
    const sym = raw.replace(/"/g, '')
    onChange(sym.trim() ? `"${sym} "` : '')
  }
  return (
    <Tip label={value ? undefined : '未设置,按圆点形状渲染;输入符号即自绘'}>
      <Input
        value={display}
        placeholder={placeholder ?? '未设置'}
        onChange={(e) => commit(e.target.value)}
        className="h-8 text-xs"
      />
    </Tip>
  )
}

/**
 * 有序列表编号模板输入:模板里的 {n} 代表自动编号,提交时编译成合法 CSS content 值存储——
 * 「第{n}章」→ "第" counter(list-item, var(--t-ol-marker-style, decimal)) "章 "。
 * counter 第二参引用编号样式令牌,样式下拉对模板同样生效;不含 {n} 时整段作为
 * 固定符号替换编号(自动补尾随空格,与无序列表自定义符号一致)。回显反向解析,
 * 识别不了的手写值原样显示。编译在控件层完成:编译器/导出/持久化对模板语法零感知。
 */
const OL_COUNTER_REF = 'counter(list-item, var(--t-ol-marker-style, decimal))'

function encodeOlMarkerTemplate(raw: string): string {
  const sym = raw.replace(/"/g, '').trim()
  if (!sym) return ''
  if (!sym.includes('{n}')) return `"${sym} "`
  const parts = sym.split('{n}')
  let value = ''
  parts.forEach((part, i) => {
    if (i > 0) value += ` ${OL_COUNTER_REF}`
    if (part) {
      // 末段自动补尾随空格作标记与正文的间隔;以 {n} 结尾时补一个空格串
      value += ` "${i === parts.length - 1 && !part.endsWith(' ') ? `${part} ` : part}"`
    } else if (i === parts.length - 1) {
      value += ' " "'
    }
  })
  return value.trim()
}

function decodeOlMarkerTemplate(value: string | undefined): string {
  const v = (value ?? '').trim()
  if (!v || v === 'normal') return ''
  // 按段解析拼接:引号段还原裸文本、counter 段还原 {n},段间空白是 CSS 分隔符不属模板
  // (全局替换会把这些分隔空格带回模板,继续编辑就会固化成「第 {n} 条」式假空格)
  const segs = v.match(/"[^"]*"|counter\(list-item(?:, ?var\(--t-ol-marker-style, decimal\)|, ?[a-z-]+)?\)/g)
  if (!segs) return v
  const template = segs
    .map((s) => (s.startsWith('"') ? s.slice(1, -1) : '{n}'))
    .join('')
  return template.replace(/ $/, '')
}

function MarkerTemplateInput({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (v: string) => void
}) {
  const display = decodeOlMarkerTemplate(value)
  return (
    <Input
      value={display}
      // 占位符直接给可抄的示例,{n} 语法不靠文档也能发现
      placeholder="如：第{n}章 → 第1章"
      onChange={(e) => onChange(encodeOlMarkerTemplate(e.target.value))}
      className="h-8 text-xs"
    />
  )
}

function weightHint(w: string) {
  const hints: Record<string, string> = {
    '100': ' 极细', '200': ' 特细', '300': ' 细', '400': ' 常规',
    '500': ' 中等', '600': ' 半粗', '700': ' 粗体', '800': ' 特粗', '900': ' 极粗',
  }
  return hints[w] ?? ''
}


/** 字段说明小字:控件的用法约定(如 {n} 编号模板)必须直接可见,不能只藏在 title 里 */
function FieldHint({ hint }: { hint?: string }) {
  if (!hint) return null
  return <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground/70">{hint}</p>
}

/**
 * 拖动取色的「绝对流畅」提交管线(ColorInput/BackgroundInput 共用):
 * 每次移动 → 色块直写 + onLivePreview 直写预览(零 React 渲染),store 提交
 * 按帧合拢,停止拖动 200ms 后经 onCommit 收口。收口定时器必须先于 rAF
 * 合拢判断设置:rAF 在窗口被遮挡等场景可能长期不触发,后置会被一同跳过,
 * store 永远停在旧值。卸载时若还有未提交的值,立即提交(避免松手瞬间丢最后一次)。
 */
function useThrottledColorSubmit(
  swatchRef: React.RefObject<HTMLSpanElement | null>,
  callbacks: {
    onChange: (v: string) => void
    onLivePreview?: (field: FieldDef, v: string) => void
    onCommit?: (field: FieldDef, v: string) => void
    field: FieldDef
  },
): (v: string) => void {
  // 始终持有最新回调(effect 内同步,避免渲染期写 ref)
  const cbRef = useRef(callbacks)
  const onChangeRef = useRef(callbacks.onChange)
  useEffect(() => {
    cbRef.current = callbacks
    onChangeRef.current = callbacks.onChange
  })

  const frame = useRef(0)
  const pendingValue = useRef<string | null>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const submitThrottled = (v: string) => {
    pendingValue.current = v
    // 实时路径:色块 + 预览容器,同步直写,无 React 参与
    if (swatchRef.current) swatchRef.current.style.background = v
    cbRef.current.onLivePreview?.(cbRef.current.field, v)
    // 最终提交:停止拖动 200ms 后收口(松手或悬停停顿)
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => {
      if (pendingValue.current !== null) {
        cbRef.current.onCommit?.(cbRef.current.field, pendingValue.current)
      }
    }, 200)
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      // store 提交仍按帧合拢(拖动中每帧至多一次,保证中栏大预览跟手)
      if (pendingValue.current !== null) {
        onChangeRef.current(pendingValue.current)
      }
    })
  }
  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current)
      if (commitTimer.current) clearTimeout(commitTimer.current)
      if (pendingValue.current !== null) onChangeRef.current(pendingValue.current)
    },
    [],
  )
  return submitThrottled
}

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
  // 取色器是受控面板,种子按可解析度逐级回落:值本身可回流(hex/rgba/oklch/
  // canvas 兜底)用值;未设置或不可解析时用回落色(未设置时色块显示的就是它,
  // 面板指针与实际观感一致);都解析不了才黑起步,色块仍显示真实色
  const safe =
    value && parseColorValue(value)
      ? value
      : fallbackColor && parseColorValue(fallbackColor)
        ? fallbackColor
        : '#000000'
  // 色块本地实时色:拖动期间直接写 DOM,不进 React state
  const swatchRef = useRef<HTMLSpanElement>(null)
  const submitThrottled = useThrottledColorSubmit(swatchRef, { onChange, onLivePreview, onCommit, field })

  // 色块显示:已设置→该色;未设置→回落色(若可测),否则透明棋盘格
  const swatchStyle: React.CSSProperties = value
    ? { background: value }
    : fallbackColor
      ? { background: fallbackColor }
      : { background: TRANSPARENT_SWATCH }

  // 未设置但测到回落色:色块显示回落色 + 输入框占位符展示当前生效色,
  // 输入/取色即覆盖,清空回到空框+占位符
  const hasFallback = Boolean(fallbackColor)

  return (
    <div className="flex items-center gap-1.5">
      <SketchPopover
        color={safe}
        onColorChange={submitThrottled}
        swatchStyle={swatchStyle}
        swatchRef={swatchRef}
        showFallbackCorner={!value && hasFallback}
      />
      {/* 回显只做占位符,不做可编辑文本:若把回落色填进受控 value,
          删空瞬间令牌被删→回显整串回来,永远删不干净(退格死循环)。
          占位符直接显示默认色值本身(灰斜体=未自设,跟随默认) */}
      <Tip label={hasFallback ? '未设置,跟随默认色;输入或取色即可覆盖' : undefined}>
        <Input
          value={value ?? ''}
          placeholder={hasFallback ? (fallbackColor as string) : '未设置'}
          onChange={(e) => onChange(e.target.value)}
          className={cn('h-8 font-mono text-xs', !value && hasFallback && 'text-muted-foreground italic')}
        />
      </Tip>
    </div>
  )
}

/** 未设置色板的「透明」标识:标准 crisp 棋盘格(国际通用的透明符号) */
const TRANSPARENT_SWATCH = 'repeating-conic-gradient(#dcdcdc 0% 25%, #ffffff 0% 50%) 0 0 / 8px 8px'

/** 预设色板:黑白 + Tailwind 500 系 */
const PRESET_COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#22c55e', '#10b981', '#14b8a6', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#6b7280',
]

/**
 * 取色器弹层面板:饱和度方块 + 色相/透明度条 + shadcn 输入行 + 预设色板。
 * 拖拽核心用 @uiw 子包(Saturation/Hue/Alpha),外壳/输入行/色板全部
 * 项目自有样式 —— 原 Sketch 整包的内联白底、下划线输入、3px 小色板不复存在。
 *
 * 受控语义与原 Sketch 一致:内部持有 hsva,外部 color prop 回流同步
 * (hex/rgba 精确回流;oklch/named 等经 parseColorValue 转换回流,面板指针
 * 同样落到真实色),拖动中 onChange 连续回调,调用方决定直写或节流。
 */
function ColorPanel({ color, onChange }: { color: string; onChange: (v: string) => void }) {
  // 内部 hsva 状态:拖动中自持;外部 color 变化时回流。
  // 初始化必须走 parseColorValue 而非 hexToHsva:种子可能是 oklch/named 串
  // (hexToHsva 对它们返回垃圾);且 prevColor 初始即等于 color,下面的回流
  // 分支对初值不生效,初始化是唯一入口
  const [hsva, setHsva] = useState<HsvaColor>(() => parseColorValue(color) ?? hexToHsva('#000000'))
  const change = (next: HsvaColor) => {
    setHsva(next)
    onChange(hsvaColorToValue(next))
  }
  // 外部 prop 回流(渲染期调整,React 官方模式):拖动中 onChange → store 回流
  // color,值等价时跳过 setState 避免拖动拔河;非法值保持原状
  const incoming = parseColorValue(color)
  const [prevColor, setPrevColor] = useState(color)
  if (incoming && prevColor !== color) {
    setPrevColor(color)
    if (!equalHsva(hsva, incoming)) setHsva(incoming)
  }

  const rgba = hsvaToRgba(hsva)

  /** 通道输入行通用提交:数值合法才进 change,非法输入不动色 */
  const submitChannel = (raw: string, apply: (hsva: HsvaColor, n: number) => HsvaColor) => {
    const n = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(n)) change(apply(hsva, n))
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* 饱和度/明度方块:指针沿用库默认圆点(白描边黑投影,任何底色都可辨);
          库对 size 是内联 style,className 压不过,尺寸走 style */}
      <Saturation
        hsva={hsva}
        onChange={(c) => change({ ...hsva, ...c, a: hsva.a })}
        radius={6}
        style={{ width: '100%', height: 144 }}
      />
      <Hue hue={hsva.h} pointer={BarPointer} radius={3} onChange={(h) => change({ ...hsva, ...h })} />
      <Alpha hsva={hsva} pointer={BarPointer} radius={3} onChange={(a) => change({ ...hsva, a: a.a })} />
      {/* 输入行:Hex 独占一行(6 位值需要宽度),RGBA 四格一行;shadcn Input
          替代库内建下划线输入框;A 通道以百分比计 */}
      <ColorChannelInput
        label="Hex"
        value={hsvaToHex(hsva).replace(/^#/, '').toUpperCase()}
        onSubmit={(raw) => {
          const hex = `#${raw.trim().replace(/^#/, '')}`
          if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) change({ ...hexToHsva(hex), a: hsva.a })
        }}
        mono
      />
      <div className="flex items-center gap-1.5">
        <ColorChannelInput
          label="R"
          value={String(rgba.r)}
          onSubmit={(raw) => submitChannel(raw, (h, n) => setRgbaChannel(h, 'r', n))}
          className="min-w-11 flex-1"
          mono
        />
        <ColorChannelInput
          label="G"
          value={String(rgba.g)}
          onSubmit={(raw) => submitChannel(raw, (h, n) => setRgbaChannel(h, 'g', n))}
          className="min-w-11 flex-1"
          mono
        />
        <ColorChannelInput
          label="B"
          value={String(rgba.b)}
          onSubmit={(raw) => submitChannel(raw, (h, n) => setRgbaChannel(h, 'b', n))}
          className="min-w-11 flex-1"
          mono
        />
        <ColorChannelInput
          label="A"
          value={String(Math.round(hsva.a * 100))}
          onSubmit={(raw) => submitChannel(raw, (h, n) => ({ ...h, a: Math.min(100, Math.max(0, n)) / 100 }))}
          className="min-w-11 flex-1"
          mono
        />
      </div>
      {/* 预设色板:rectRender 自绘格子 —— shadcn 圆角/间距/选中描边,替代库默认 3px 小方块;
          Swatch 是 flex-wrap 容器,格子间 gap-1.5 */}
      <Swatch
        colors={PRESET_COLORS}
        color={hsvaToHex(hsva)}
        onChange={(hsv) => change({ ...hsv, a: hsva.a })}
        className="gap-1.5"
        rectRender={({ color: c, checked, style, onClick }) => (
          <Tip key={c} label={c}>
            <button
              type="button"
              aria-label={`预设色 ${c}`}
              aria-pressed={checked}
              onClick={(e) => onClick(e as unknown as React.MouseEvent<HTMLDivElement>)}
              className={cn(
                'size-4 shrink-0 rounded-sm border border-black/10 transition-shadow hover:scale-110',
                checked && 'ring-2 ring-ring ring-offset-1 ring-offset-popover',
              )}
              style={{ background: c, ...style, height: 16, width: 16, margin: 0 }}
            />
          </Tip>
        )}
      />
    </div>
  )
}

/**
 * color prop → hsva,四级解析:hex / rgb() 精确直解;oklch 数学转换
 * (css-color 库);其余浏览器认识格式(named/color()/百分号 rgb)canvas
 * 兜底。都失败返回 null(回流时保持原状)。
 */
function parseColorValue(v: string): HsvaColor | null {
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return hexToHsva(v)
  const m = v.match(/^rgba?\(([^)]+)\)$/i)
  if (m) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return rgbaToHsva({ r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 })
    }
  }
  const rgba = oklchToRgba(v) ?? cssColorToRgba(v)
  return rgba ? rgbaToHsva(rgba) : null
}

/** 拖动回流守卫:hsva 各分量都在浮点噪声容差内视为相等,避免 setHsva 抖动 */
function equalHsva(a: HsvaColor, b: HsvaColor): boolean {
  const near = (x: number, y: number) => Math.abs(x - y) < 1e-6
  return near(a.h, b.h) && near(a.s, b.s) && near(a.v, b.v) && near(a.a, b.a)
}

/** hsva → 弹层对外值:a=1 出 hex(主流场景值干净),否则 rgba() 串 */
function hsvaColorToValue(hsva: HsvaColor): string {
  return hsva.a === 1
    ? hsvaToHex(hsva)
    : `rgba(${hsvaToRgba(hsva).r}, ${hsvaToRgba(hsva).g}, ${hsvaToRgba(hsva).b}, ${Math.round(hsva.a * 100) / 100})`
}

const clamp255 = (n: number) => Math.min(255, Math.max(0, Math.round(n)))

/** 纯色 RGB 通道写入:把 r/g/b 之一设到 hsva 对应的 rgba 上,再转回 hsva */
function setRgbaChannel(hsva: HsvaColor, channel: 'r' | 'g' | 'b', n: number): HsvaColor {
  return { ...hsva, ...rgbaToHsva({ ...hsvaToRgba(hsva), [channel]: clamp255(n) }) }
}

/** 色相/透明度条的指针:细竖条(替代库默认圆点),观感对齐原生取色器 */
function BarPointer({ left }: { left?: string; top?: string; prefixCls?: string; fillProps?: React.HTMLAttributes<HTMLDivElement> }) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 w-1 rounded-full border border-black/20 bg-white shadow-sm"
      style={{ left }}
    />
  )
}

/** 通道输入行单项:shadcn Input + 下方小字标签,替代库内建下划线输入框。
    聚焦中显示本地草稿,失焦显示外部值(拖动/取色实时同步);提交走 onSubmit */
function ColorChannelInput({
  label,
  value,
  onSubmit,
  className,
  mono = false,
}: {
  label: string
  value: string
  onSubmit: (raw: string) => void
  className?: string
  mono?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value)
  return (
    <label className={cn('flex min-w-0 flex-col gap-0.5', className)}>
      <span className="text-center text-[10px] leading-none text-muted-foreground">{label}</span>
      <Input
        value={focused ? draft : value}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          setFocused(true)
          setDraft(value)
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSubmit(draft)
            e.currentTarget.blur()
          }
        }}
        className={cn('h-7 px-1.5 text-center text-xs', mono && 'font-mono')}
      />
    </label>
  )
}

/**
 * Sketch 取色器弹层:色块触发 + 面板(饱和度/色相/透明度/通道输入/预设色板)
 * + 吸管。onColorChange 在拖动/输入/选色时连续回调,调用方决定直写或节流。
 * swatchRef 供调用方在拖动中直写色块色(绕过 React)。
 */
function SketchPopover({
  color,
  onColorChange,
  swatchStyle,
  swatchRef,
  swatchLabel = '取色器',
  showFallbackCorner = false,
}: {
  color: string
  onColorChange: (v: string) => void
  swatchStyle: React.CSSProperties
  swatchRef?: React.RefObject<HTMLSpanElement | null>
  swatchLabel?: string
  showFallbackCorner?: boolean
}) {
  return (
    <Popover>
      <Tip label="点击打开取色器">
        <PopoverTrigger asChild>
          <button
            type="button"
            className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border"
            aria-label={swatchLabel}
          >
            <span ref={swatchRef} className="absolute inset-0" style={swatchStyle} />
            {showFallbackCorner && (
              <span
                aria-hidden
                className="absolute right-0 bottom-0 size-2.5 border-t border-l border-border bg-background/85"
              />
            )}
          </button>
        </PopoverTrigger>
      </Tip>
      {/* 基类自带 flex-col gap-4,这里用 gap-2.5 覆盖(space-y 会与 gap 叠加) */}
      <PopoverContent className="w-64 gap-2.5 p-3" align="start">
        <ColorPanel color={color} onChange={onColorChange} />
        {/* 系统取色器的吸管是独有能力,面板里保留一个入口 */}
        <Button
          type="button"
          variant="outline"
          className="h-7 w-full text-xs text-muted-foreground"
          onClick={async () => {
            const EyeDropper = (window as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
            if (!EyeDropper) return
            try {
              const { sRGBHex } = await new EyeDropper().open()
              onColorChange(sRGBHex)
            } catch {
              /* 用户按 Esc 取消 */
            }
          }}
        >
          从屏幕取色
        </Button>
      </PopoverContent>
    </Popover>
  )
}

/**
 * 画布背景控件:值 = 完整 CSS background(颜色/渐变/图片),由预览滚动容器
 * 以 background 原样消费。色块 + hex 覆盖最常用的纯色;「图片…」把本机图片
 * 压成 data URL 内嵌进主题值(主题要可分享可导出,不能引用本机路径);
 * 自由文本承接渐变、多背景等高级写法。
 */
function BackgroundInput({
  field,
  value,
  onChange,
  onLivePreview,
  onCommit,
}: {
  field: FieldDef
  value: string | undefined
  onChange: (v: string) => void
  /** 拖动实时预览:app.bg 直写画布容器 background(app.bg 的消费点是
      React 内联样式,CSS 变量写了对它无效),绕过编译+整树重渲染 */
  onLivePreview?: (field: FieldDef, v: string) => void
  /** 停止拖动 200ms 后的最终提交 */
  onCommit?: (field: FieldDef, v: string) => void
}) {
  const [picking, setPicking] = useState(false)
  const hasImage = value?.includes('url(') ?? false
  // 色块即预览:颜色/图片都是 background 值,直接渲染到色块上;未设置 = 透明棋盘格
  const swatchStyle: React.CSSProperties = value ? { background: value } : { background: TRANSPARENT_SWATCH }
  const swatchRef = useRef<HTMLSpanElement>(null)
  // 种子链与 ColorInput 同款:值可回流用值(oklch 也同步),图片值/非法值白起步
  const safe = value && parseColorValue(value) ? value : '#ffffff'
  /** 取色拖动专用:色块直写 + 画布直写 + rAF 合拢提交,200ms 收口(与 ColorInput 同管线) */
  const submitThrottled = useThrottledColorSubmit(swatchRef, { onChange, onLivePreview, onCommit, field })

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
      {/* 图片态不叠取色器:点色块换色会静默丢掉图片,换色走清空后重设 */}
      {hasImage ? (
        <span className="relative size-8 shrink-0 overflow-hidden rounded-md border">
          <span className="absolute inset-0" style={swatchStyle} />
        </span>
      ) : (
        <SketchPopover
          color={safe}
          onColorChange={submitThrottled}
          swatchStyle={swatchStyle}
          swatchRef={swatchRef}
          swatchLabel="画布背景取色器"
        />
      )}
      <Input
        value={value ?? ''}
        placeholder="未设置"
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 flex-1"
      />
      <Tip label="插入背景图片" side="bottom">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          disabled={picking}
          onClick={() => void pickImage()}
          aria-label="插入背景图片"
        >
          <IconPhotoPlus className="size-[18px]" />
        </Button>
      </Tip>
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
  /** 未设置时的真实回落值(如 '0.2em 0.35em'),逐边拆成占位符;空串=默认真是 0 */
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
  // 未设置的占位符:逐边拆默认值(每格只放自己那边的数值,不塞完整简写);
  // 默认值解析不了(如 'auto')时统一占位 0
  const phSides = parse(placeholder)
  const placeholders = phSides?.map((s) => s[0]) ?? ['0', '0', '0', '0']
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
      <NumberCell
        value={base[i][0]}
        placeholder={placeholders[i]}
        ariaLabel={['上', '右', '下', '左'][i]}
        onChange={(n) => emit(i, n)}
        className="h-7 min-w-0 flex-1 px-1 text-center text-xs"
      />
    </label>
  )
  return (
    <div className="flex items-center gap-1">
      {/* 2×2 两排(上右 / 下左):每格比单行宽一倍,格子撑满列宽不留右侧空白;
          10px 常显方位标签免 hover,隐藏 spinner 降视觉噪音 */}
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-1">
        {cell(0)}
        {cell(1)}
        {cell(2)}
        {cell(3)}
      </div>
      <Select
        value={curUnit}
        onValueChange={(u) => {
          setLastUnit(u)
          emitSides(base.map((s) => [s[0], u] as [string, string]))
        }}
      >
        <SelectTrigger size="sm" className="w-20 shrink-0">
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
/** 数字 + 单位。存值约定：带单位字符串（'16px' / '1.25em'），纯数字按默认单位补。
    单位候选跟随字段语义:时间类(s/ms)给时间单位,其余给长度单位 */
const UNIT_OPTIONS_LENGTH = ['px', 'em', 'rem', '%']
const UNIT_OPTIONS_TIME = ['s', 'ms']

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
  const unitOptions = UNIT_OPTIONS_TIME.includes(unit) ? UNIT_OPTIONS_TIME : UNIT_OPTIONS_LENGTH
  const emit = (n: string, u: string) => {
    if (n !== '') setLastUnit(u)
    onChange(n === '' ? '' : `${n}${u}`)
  }
  return (
    <div className="flex items-center gap-1">
      <NumberCell
        value={num}
        placeholder={placeholder}
        onChange={(n) => emit(n, curUnit)}
        className="h-8 min-w-0 flex-1 text-xs"
      />
      <Select
        value={curUnit}
        onValueChange={(u) => {
          if (num === '') {
            // 空值时切单位只记住选择,不凭空创建 0 值令牌;输入时按 lastUnit 走
            setLastUnit(u)
            return
          }
          emit(num, u)
        }}
      >
        <SelectTrigger size="sm" className="w-20 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {unitOptions.map((u) => (
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

/** 百分比：纯数字输入,固定 % 单位(比例类字段如背景深浅,px/em/rem 无意义,无单位下拉)。
    存值约定与 SizeInput 一致:带单位字符串('8%'),清空发 '' 删令牌回落默认 */
function PercentInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | undefined
  onChange: (v: string) => void
  placeholder?: string
}) {
  // % 后缀可省(容忍历史裸数字存值)
  const m = value?.match(/^(-?[\d.]+)%?$/)
  return (
    <NumberCell
      value={m?.[1] ?? ''}
      onChange={(n) => onChange(n === '' ? '' : `${n}%`)}
      placeholder={placeholder}
      className="h-8 min-w-0 flex-1 text-xs"
    />
  )
}

/**
 * 数字格共用输入件,替代受控的 type=number——number 输入的三宗罪:
 * "0." 中间态 badInput 把小数点吞掉;空值被上层「空边回落 0」规范化后受控重渲染
 * 盖写回框,格子一旦有值永远清不空(backspace 无效);原生 ↑↓ 步进与受控值打架会清值。
 * - text + inputMode=decimal,输入时只放行数字/一个小数点/前导负号(全角数字顺手转半角)
 * - 聚焦全选:点进已有值的格子输入即替换,不会追加成 "01"
 * - 焦点内显示草稿:空串/尾点等过渡态原样保留不回弹;每次按键仍向父层报合法值(尾点折掉/空串)
 * - 失焦规范化:parseFloat 清前导零("01"→"1"),按 min/max 收敛
 * - ↑↓ 手动步进补回 number 原生行为(±step,Shift=±10×step);value 恒为裸数字
 */
function NumberCell({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
  step = 1,
  min,
  max,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
  step?: number
  min?: number
  max?: number
}) {
  // 焦点内的显示草稿;null = 未聚焦,展示受控值
  const [draft, setDraft] = useState<string | null>(null)
  const clamp = (n: number) => {
    let v = n
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    return v
  }
  // 入库值:过渡态(尾点/孤立负号/空串)折成合法值,避免预览吃到 "1.em" 这类非法 CSS
  const clean = (s: string) => {
    if (s === '' || s === '-') return ''
    if (s.endsWith('.')) return s.slice(0, -1)
    return s
  }
  const commit = (s: string) => {
    setDraft(s)
    const c = clean(s)
    if (c !== value) onChange(c)
  }
  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft ?? value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        // 只放行数字/一个点/前导负号;全角数字、全角点转半角
        let out = ''
        let dot = false
        for (const ch of e.target.value.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))) {
          const c = ch === '．' ? '.' : ch
          if (c >= '0' && c <= '9') out += c
          else if (c === '.' && !dot) {
            out += c
            dot = true
          } else if (c === '-' && out === '') out += c
        }
        commit(out)
      }}
      onBlur={() => {
        const d = draft
        setDraft(null)
        if (d !== null && d !== '' && d !== '-') {
          const n = parseFloat(d)
          if (!Number.isNaN(n)) {
            const s = String(clamp(n))
            if (s !== d && s !== value) onChange(s)
          }
        }
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
        e.preventDefault()
        const shown = draft ?? value
        const cur = parseFloat(shown === '' || shown === '-' ? '0' : shown)
        if (Number.isNaN(cur)) return
        // 浮点尾差收敛:按 step 与当前值中小数位较多者四舍五入
        // (1.1-1=0.10000000000000009 → 0.1;0.1+1=1.1 不被 step=1 的整数精度砍成 1)
        const decimalsOf = (n: number) => (String(n).split('.')[1] ?? '').length
        const decimals = Math.max(decimalsOf(cur), decimalsOf(step))
        const next = Number((cur + (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)).toFixed(decimals))
        commit(String(clamp(next)))
      }}
    />
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
  const mono = /^inlineCode\.font|^codeBlock\.font/.test(field.key)
  // 回显 = 纯当前生效字体名(灰斜体表示非自设);跟随来源(标题跟共用、
  // 共用跟正文)挪进 hover 提示,不再占文本前缀
  const followPrefix = /^h[1-6]\.font(Latin|Cjk)$/.test(field.key)
    ? '跟随标题（共用）'
    : /^heading\.font(Latin|Cjk)$/.test(field.key)
      ? '跟随正文'
      : '跟随基础样式表默认'
  const echo = !value && fallbackFamily ? fallbackFamily : undefined
  return (
    <FontField
      label=""
      value={value ?? ''}
      onChange={onChange}
      placeholder="未设置"
      mono={mono}
      fonts={fonts}
      echo={echo}
      echoTitle={fallbackFamily ? `${followPrefix} · 当前生效字体,点选即可覆盖` : undefined}
    />
  )
}