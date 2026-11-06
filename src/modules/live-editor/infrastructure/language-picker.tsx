import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { CODE_LANGUAGES, displayLanguage } from '@/modules/rendering/code-highlight'
import { languageIcon } from '@/modules/rendering/language-icons'

/**
 * 代码块 header 语言选择浮层(shadcn Popover+Command,可搜索)。
 *
 * 宿主是 CodeMirror NodeView 的手工 DOM(header 行语言文本),经
 * language-picker-mount 的 createRoot 桥挂载(组件与桥拆两文件是为
 * react-refresh 边界:本文件只出组件)。选择/关闭即整体卸载。
 * 锚点(Anchor)必须是真实盒子——display:contents 不产生布局框,
 * Radix 量不到位置会回退到屏幕左上角;用绝对定位铺满语言文本
 * (.themd-code-lang-anchor,index.css),浮层从其下弹出。
 * 语言清单来自 code-highlight 的高亮注册表(单源);mermaid 不在清单里
 * ——它有独立图表视图,语言→mermaid 的切换由 fence 源码负责。
 */
export function LanguagePicker({
  onChange,
  onClose,
}: {
  onChange: (lang: string) => void
  onClose: () => void
}) {
  return (
    <Popover defaultOpen onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <PopoverAnchor asChild>
        <span className="themd-code-lang-anchor" />
      </PopoverAnchor>
      <PopoverContent className="w-44 p-0" align="start">
        {/* cmdk filter 回调签名:(value, search) 均为字符串 */}
        <Command filter={(value, search) =>
          value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
        }>
          <CommandInput placeholder="搜索语言…" />
          <CommandList>
            <CommandEmpty>无匹配语言</CommandEmpty>
            <CommandGroup>
              {CODE_LANGUAGES.map((lang) => {
                const { Icon, color } = languageIcon(lang)
                return (
                  <CommandItem
                    key={lang}
                    value={lang}
                    onSelect={() => {
                      onChange(lang)
                      onClose()
                    }}
                  >
                    <Icon size={14} color={color} />
                    {displayLanguage(lang)}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
