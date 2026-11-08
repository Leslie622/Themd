import { useState } from 'react'
import { css } from '@codemirror/lang-css'
import CodeMirror from '@uiw/react-codemirror'
import { IconEraser, IconDeviceFloppy } from '@tabler/icons-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/**
 * 附加自定义 CSS 编辑器（P4）。
 * 按约定直接写元素选择器（strong { … }），保存时由 scopeExtraCss 统一包装 .themd-prose 作用域。
 * 编辑为本地草稿，点「保存」才写入主题；「清空」一键移除全部附加 CSS。
 * 父级以主题 id 作 key 重挂本组件,草稿随之重置,无需 effect 同步。
 */
export function CssEditorPanel({
  value,
  onSave,
}: {
  value: string | undefined
  onSave: (css: string) => void
}) {
  const [draft, setDraft] = useState(value ?? '')

  const dirty = draft !== (value ?? '')

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border text-xs">
        <CodeMirror
          value={draft}
          onChange={setDraft}
          height="180px"
          extensions={[css()]}
          basicSetup={{ foldGutter: false, highlightActiveLine: false }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        直接写元素选择器即可（如 <code>strong {'{'}</code>），自动限定在预览区内生效，最后应用、可覆盖上面所有设置。
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          disabled={!dirty}
          onClick={() => {
            onSave(draft)
            toast.success('附加 CSS 已保存')
          }}
        >
          <IconDeviceFloppy /> 保存
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!value}
          onClick={() => {
            setDraft('')
            onSave('')
            toast.success('已清空附加 CSS')
          }}
        >
          <IconEraser /> 清空
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">未保存</span>}
      </div>
    </div>
  )
}
