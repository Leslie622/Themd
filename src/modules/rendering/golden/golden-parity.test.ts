import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { renderStaticHtml } from '../static-html'

/**
 * TipTap 静态渲染 × 金样语料 守门(第 2 步输出线,2026-11-03 全绿转常驻)。
 *
 * 逐字节对比 renderStaticHtml(corpus) 与 md-it 冻结期望:
 * - md-it 侧改动由 golden-corpus.test 守(语料↔冻结);
 * - TipTap schema/解析/静态序列化器改动由本测试守;
 * 两侧任一漂移即红。调试时差异清单按行打印。
 */

const dir = dirname(fileURLToPath(import.meta.url))
const corpusPath = join(dir, 'corpus.md')
const expectedPath = join(dir, 'corpus.expected.html')

const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim()
const trunc = (line: string | undefined, max = 150) =>
  line === undefined ? '(缺失)' : line.length > max ? `${line.slice(0, max)}…` : line

describe('TipTap 静态渲染 × 金样语料 守门(输出线)', () => {
  it('renderStaticHtml(corpus) 与冻结期望逐字节一致', () => {
    const corpus = normalize(readFileSync(corpusPath, 'utf8'))
    const expected = normalize(readFileSync(expectedPath, 'utf8'))
    const actual = normalize(renderStaticHtml(corpus))

    if (actual === expected) return

    const expLines = expected.split('\n')
    const actLines = actual.split('\n')
    const report: string[] = []
    let total = 0
    for (let i = 0; i < Math.max(expLines.length, actLines.length); i++) {
      if (expLines[i] === actLines[i]) continue
      total++
      if (report.length < 120) {
        report.push(`L${i + 1}`)
        report.push(`  期望| ${trunc(expLines[i])}`)
        report.push(`  实际| ${trunc(actLines[i])}`)
      }
    }
    console.log(
      `\n===== 差异清单(共 ${total} 行不一致,${report.length / 3 >= 40 ? '前 40' : `全部 ${total}`} 处)=====\n` +
        report.join('\n'),
    )
    expect.fail(`静态渲染与金样期望存在 ${total} 行差异——输出线未拉平,见上方清单`)
  })
})
