import { describe, expect, it } from 'vitest'
import { extractAssetRefs } from './note-assets'

describe('extractAssetRefs', () => {
  it('extracts deduplicated assets image refs from markdown', () => {
    const content = [
      '![截图](assets/a-1234abcd.png)',
      '![截图](assets/a-1234abcd.png)',
      '![另一张](assets/b-1111bbbb.jpeg)',
      '![外链](https://example.com/x.png)',
      '![内嵌](data:image/png;base64,AAAA)',
      '正文 [链接](assets/not-image.md)',
    ].join('\n')
    expect(extractAssetRefs(content)).toEqual(['assets/a-1234abcd.png', 'assets/b-1111bbbb.jpeg'])
  })

  it('returns empty for content without assets refs', () => {
    expect(extractAssetRefs('# 标题\n\n没有图片')).toEqual([])
  })
})
