import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown-renderer'

describe('renderMarkdown', () => {
  it('renders headings, images, and highlighted code through one pipeline', () => {
    const document = renderMarkdown('# Title\n\n![image](data:image/png;base64,x)\n\n```js\nconst value = 1\n```')
    expect(document.html).toContain('id="title"')
    expect(document.html).toContain('loading="lazy"')
    expect(document.html).toContain('language-js')
  })
})
