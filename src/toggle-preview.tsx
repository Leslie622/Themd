import { createRoot } from 'react-dom/client'
import '@/index.css'
import { PreviewPane } from '@/components/PreviewPane'
import { AutoHideScrollArea } from '@/components/AutoHideScrollArea'

const LONG_MD = Array.from({ length: 40 }, (_, i) => {
  return [
    `## 第 ${i + 1} 节 标题示例`,
    '',
    '这是一段足够长的正文文本,用来把预览区撑出纵向滚动。' + '滚动条行为验证用,内容本身无意义。'.repeat(3),
    '',
    '- 列表项甲',
    '- 列表项乙',
    '',
    '```ts',
    `const x${i} = ${i}`,
    '```',
    '',
  ].join('\n')
}).join('\n')

const listItems = Array.from({ length: 80 }, (_, i) => `列表项 ${i + 1}`)

function App() {
  return (
    <div className="flex h-[800px] w-[1280px]">
      <div className="flex h-full w-60 flex-col border-r bg-sidebar">
        <AutoHideScrollArea className="flex-1">
          <div className="flex h-full flex-col space-y-0.5 p-2">
            {listItems.map((t) => (
              <div key={t} className="truncate rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                {t}
              </div>
            ))}
          </div>
        </AutoHideScrollArea>
      </div>
      <div className="min-w-0 flex-1">
        <PreviewPane content={'# 预览标题\n\n' + LONG_MD} />
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
