import { Minus, Plus, Settings } from 'lucide-react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EDITOR_FONT_RANGE, useEditorPrefs } from '@/store-editor'

/** 应用设置抽屉:编辑器偏好等。 */
export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fontSize = useEditorPrefs((s) => s.fontSize)
  const setFontSize = useEditorPrefs((s) => s.setFontSize)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>设置</SheetTitle>
          <SheetDescription>应用偏好设置,实时生效并自动保存。</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4">
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

export { Settings as SettingsIcon }
