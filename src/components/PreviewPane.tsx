import { memo, useMemo } from 'react'
import 'highlight.js/styles/github.css'

import { md } from '@/lib/markdown'

export const PreviewPane = memo(function PreviewPane({ content }: { content: string }) {
  const html = useMemo(() => md.render(content), [content])
  return (
    <div className="h-full overflow-y-auto">
      <article
        className="prose prose-neutral mx-auto max-w-3xl px-6 py-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})
