import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { isFontAvailable } from './is-font-available'
import { useLocalFontList } from './use-local-font-list'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { toast } from 'sonner'

/**
 * 字体选择弹窗:完整本机字体列表 + 搜索 + 复制。
 * 打开时自动请求完整列表(桌面端 IPC 直出;浏览器端弹一次授权,
 * 拒绝后回落探测名单)。点击字体行应用到所属槽位;行内按钮单独复制族名。
 * 值输入框支持粘贴多个逗号分隔的族名(font-family 语义)。
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
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const { requesting, requestFullList } = useLocalFontList()

  // 每次打开弹窗自动刷新完整列表;首次授权后,后续会话用缓存免重复授权
  useEffect(() => {
    if (open) void requestFullList(true)
  }, [open, requestFullList])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return fonts
    return fonts.filter((f) => f.toLowerCase().includes(q))
  }, [fonts, query])

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
      <DialogContent className="flex h-[28rem] max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-sm">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            从本机字体列表中选择或复制字体名称
          </DialogDescription>
        </DialogHeader>
        <div className="border-b px-4 py-2.5">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={requesting ? '正在读取本机字体…' : `搜索 ${fonts.length} 个字体…`}
            className="h-7 text-xs"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">
              {requesting || fonts.length === 0 ? '正在读取本机字体…' : '没有匹配的字体'}
            </p>
          ) : (
            filtered.map((f) => {
              const active = value.trim().toLowerCase() === f.toLowerCase()
              return (
                <div
                  key={f}
                  className="group flex items-center gap-1 rounded-md pr-1 hover:bg-accent"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left"
                    style={{ fontFamily: `'${f}', ${mono ? 'monospace' : 'sans-serif'}` }}
                    onClick={() => {
                      onChange(f)
                      onOpenChange(false)
                    }}
                  >
                    <span className="truncate text-sm">{f}</span>
                    {active && <Check className="size-3.5 shrink-0 text-primary" />}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`复制 ${f}`}
                    onClick={() => void copy(f)}
                  >
                    {copied === f ? (
                      <Check className="size-3 text-primary" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </Button>
                </div>
              )
            })
          )}
        </div>
        <div className="border-t px-4 py-2.5">
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
 * 单个字体槽位字段:展示当前字体(以自身渲染预览),点击打开字体列表弹窗。
 * 值为自由文本,支持 font-family 式多族名。
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
      {/* 观感对齐 shadcn SelectTrigger(size=sm):同内边距/圆角/字号/下拉箭头,
          让设置页所有选择类控件视觉语言一致 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-7 w-full items-center justify-between gap-1.5 rounded-[min(var(--radius-md),10px)] border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm transition-colors outline-none select-none hover:bg-input/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
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
