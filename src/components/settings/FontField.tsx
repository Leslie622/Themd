import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
 * 字体选择弹窗(Dialog 形式):shadcn Dialog 外壳 + 内嵌 Command 面板。
 * Command 提供搜索过滤/键盘导航/空态;逐行复制按钮与底部自由输入框
 * (font-family 多族名)是超出 Command 语义的产品点,以允许的组合方式保留。
 */
function FontListDialog({
  open,
  onOpenChange,
  title,
  value,
  onChange,
  mono,
  fonts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  value: string
  onChange: (v: string) => void
  mono?: boolean
  fonts: string[]
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const { requesting, requestFullList } = useLocalFontList()

  // 打开弹窗时自动刷新完整列表;首次授权后,后续会话用缓存免重复授权
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* p-0 + overflow-hidden:Command 占满,自身圆角被 Dialog 裁齐;
          showCloseButton=false:关闭走 Esc/点外部,搜索框右上不留悬停 X */}
      <DialogContent
        showCloseButton={false}
        className="flex h-[28rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-md [&_[cmdk-root]]:rounded-none"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>从本机字体列表中选择或复制字体名称</DialogDescription>
        </DialogHeader>
        <Command className="min-h-0 flex-1">
          <CommandInput
            placeholder={requesting ? '正在读取本机字体…' : `搜索 ${fonts.length} 个字体…`}
          />
          <CommandList className="min-h-0 flex-1 max-h-none">
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
                    onOpenChange(false)
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
        </Command>
        <div className="border-t p-1.5">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="或直接输入,可用英文逗号分隔多个字体名"
            className="h-7 text-xs"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 单个字体槽位字段:展示当前字体(以自身渲染预览),点击打开字体弹窗。
 * 触发器观感对齐 SelectTrigger(size=sm);值为自由文本,支持多族名。
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
  const display = value.trim()
  const notInstalled = display && !isFontAvailable(display.split(',')[0].trim())

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 w-full items-center justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-xs transition-colors outline-none select-none hover:bg-input/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
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
      {notInstalled && (
        <p className="text-xs text-amber-600 dark:text-amber-400">未安装,显示回落效果</p>
      )}
      <FontListDialog
        open={open}
        onOpenChange={setOpen}
        title={`选择${label}字体`}
        value={value}
        onChange={onChange}
        mono={mono}
        fonts={fonts}
      />
    </div>
  )
}
