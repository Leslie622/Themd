import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { md } from '../markdown-renderer'

/**
 * 金样语料守门——渲染结构契约(见 docs/渲染结构契约.md)的执行机构。
 *
 * corpus.md 是全元素覆盖文稿;corpus.expected.html 是用当前 markdown-it 管线
 * 冻结的期望输出,即「规范记录」。任何渲染器(含迁移期的 TipTap generateHTML)
 * 对同一语料的输出必须与之逐字节一致。
 *
 * 管线有意变更(新增/修改渲染规则)时重新冻结:
 *   Git Bash:  GOLDEN_UPDATE=1 npx vitest run src/modules/rendering/golden
 *   PowerShell: $env:GOLDEN_UPDATE=1; npx vitest run src/modules/rendering/golden
 * 重新冻结必须伴随契约文档的同步修订,不许「先改输出后补文档」。
 */

const dir = dirname(fileURLToPath(import.meta.url))
const corpusPath = join(dir, 'corpus.md')
const expectedPath = join(dir, 'corpus.expected.html')

/** git 换行策略可能把文件检出自 CRLF,比较前统一归一;首尾空白不参与契约 */
const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim()

describe('金样语料守门(渲染结构契约)', () => {
  it('当前管线输出与冻结的期望 HTML 逐字节一致', () => {
    const corpus = normalize(readFileSync(corpusPath, 'utf8'))
    const html = normalize(md.render(corpus))

    if (process.env.GOLDEN_UPDATE) {
      writeFileSync(expectedPath, `${html}\n`, 'utf8')
      return
    }

    const expected = normalize(readFileSync(expectedPath, 'utf8'))
    expect(html).toBe(expected)
  })
})
