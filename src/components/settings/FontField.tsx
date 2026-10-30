import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { isFontAvailable } from './is-font-available'
import { useLocalFontList } from './use-local-font-list'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { toast } from 'sonner'

/**
 * 单个字体槽位字段(Combobox 模式):shadcn Popover + Command 组合。
 * trigger 对齐 SelectTrigger(size=sm) 观感;面板为 Command 可搜索列表,
 * 逐行附复制按钮(Command 无此语义,行内嵌 Button 是官方允许的组合);
 * 底部自由输入框支持 font-family 式多族名粘贴,超出 Combobox 语义,
 * 作为面板 footer 保留。
 */
export function FontField({
  label,
  value,
  onChange,
  placeholder,
  mono,
  fonts,
}: {
  /** 行上方小标签;空串 = 不渲染(行内布局,由外层行名表意) */
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  mono?: boolean
  fonts: string[]
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const { requesting, requestFullList } = useLocalFontList()
  const display = value.trim()
  const notInstalled = display && !isFontAvailable(display.split(',')[0].trim())

  // 打开面板时自动刷新完整列表;首次授权后,后续会话用缓存免重复授权
  useEffect(() => {
    if (open) void requestFullList(true)
  }, [open, requestFullList])

  const copy = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name)
      setCopied(name)
      setTimeout(() => setCopied((c) => (c === name ? null : c)), 1500)
    } catch {
      toast.error('复制失败,请手动选择文本复制')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <Popover open={open} onOpenChange={setOpen}>
        {/* 观感对齐 SelectTrigger(size=sm):同高/内边距/圆角/字号/箭头 */}
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex h-7 w-full items-center justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-xs transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground hover:bg-input/50 dark:bg-input/30 dark:hover:bg-input/50"
            aria-label={`选择${label}字体`}
          >
            <span
              className="truncate"
              style={display ? { fontFamily: `'${display.split(',')[0].trim()}', ${mono ? 'monospace' : 'sans-serif'}` } : undefined}
            >
              {display || <span className="text-muted-foreground">{placeholder}</span>}
            </span>
            <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[20rem] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            {/* 搜索框聚焦优先;自由输入放 footer,不与搜索争焦点 */}
            <CommandInput
              placeholder={requesting ? '正在读取本机字体…' : `搜索 ${fonts.length} 个字体…`}
            />
            <CommandList className="max-h-64">
              <CommandEmpty>
                {requesting || fonts.length === 0 ? '正在读取本机字体…' : '没有匹配的字体'}
              </CommandEmpty>
              {fonts.map((f) => {
                const active = value.trim().toLowerCase() === f.toLowerCase()
                return (
                  <CommandItem
                    key={f}
                    value={f}
                    onSelect={() => {
                      onChange(f)
                      setOpen(false)
                    }}
                    style={{ fontFamily: `'${f}', ${mono ? 'monospace' : 'sans-serif'}` }}
                  >
                    <span className="min-w-0 flex-1 truncate">{f}</span>
                    {/* 复制是面板内第二动作,嵌套按钮阻止 onSelect 冒泡 */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`复制 ${f}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        void copy(f)
                      }}
                    >
                      {copied === f ? (
                        <Check className="size-3 text-primary" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                    {active && <Check className="size-3.5 shrink-0 text-primary" />}
                  </CommandItem>
                )
              })}
            </CommandList>
            <div className="border-t p-1.5">
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="或直接输入,可用英文逗号分隔多个字体名"
                className="h-7 text-xs"
              />
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {notInstalled && (
        <p className="text-xs text-amber-600 dark:text-amber-400">未安装,显示回落效果</p>
      )}
    </div>
  )
}
