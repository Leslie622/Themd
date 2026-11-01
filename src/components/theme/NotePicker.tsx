import { Check, ChevronsUpDown, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Note } from '@/modules/notebook/domain/note'

/**
 * 工场「导入笔记」模式的选文器:从当前工作区挑一篇 Markdown 笔记作为预览
 * 文稿。Popover + Command(shadcn combobox 组合),按标题搜索;选中后内容
 * 会复制为工场内的编辑副本,不写回源文件。
 */
export function NotePicker({
  notes,
  selectedId,
  open,
  onOpenChange,
  onPick,
}: {
  notes: Note[]
  selectedId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (id: string) => void
}) {
  const selected = notes.find((n) => n.id === selectedId) ?? null
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 max-w-44 gap-1 px-2 text-xs font-normal text-muted-foreground"
          aria-label="选择预览笔记"
        >
          <FileText className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? selected.title : '选择笔记'}
          </span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder="搜索笔记标题…" />
          <CommandList>
            <CommandEmpty>没有匹配的笔记</CommandEmpty>
            <CommandGroup>
              {notes.map((n) => (
                <CommandItem
                  key={n.id}
                  value={n.title}
                  onSelect={() => {
                    onPick(n.id)
                    onOpenChange(false)
                  }}
                >
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{n.title}</span>
                  {n.id === selectedId && <Check className="size-3.5 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
