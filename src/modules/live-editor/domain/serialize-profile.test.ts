import { describe, expect, it } from 'vitest'
import { applyBulletStyle, applyEol, buildProfile } from './serialize-profile'

describe('buildProfile', () => {
  it('检测列表标记/强调风格/行尾', () => {
    const p = buildProfile('* 甲\r\n* 乙\r\n\r\n正文 __粗体__ 与 _斜体_\r\n')
    expect(p).toEqual({ bullet: '*', strong: '__', em: '_', eol: '\r\n' })
  })

  it('CommonMark 惯例回落(无任何标记/Unix 行尾)', () => {
    expect(buildProfile('普通正文')).toEqual({ bullet: '-', strong: '**', em: '*', eol: '\n' })
  })

  it('各维度独立统计(混合风格取多数)', () => {
    const p = buildProfile('- 甲\n- 乙\n- 丙\n* 孤例\n\n**a** 与 __b__')
    expect(p.bullet).toBe('-')
    expect(p.strong).toBe('**')
  })
})

describe('applyBulletStyle', () => {
  it('行首 `- ` 换为目标标记,缩进保留', () => {
    expect(applyBulletStyle('- a\n  - b\n正文 - c', '*')).toBe('* a\n  * b\n正文 - c')
  })

  it('围栏块整体跳过(代码内的 - 注释不动)', () => {
    const fenced = '```yaml\n- 注释\n```'
    expect(applyBulletStyle(fenced, '*')).toBe(fenced)
  })

  it('目标就是 - 时原样返回', () => {
    expect(applyBulletStyle('- a', '-')).toBe('- a')
  })
})

describe('applyEol', () => {
  it('序列化产物(LF)统一为 CRLF;已是 CRLF 的不重复', () => {
    expect(applyEol('a\nb\r\nc', '\r\n')).toBe('a\r\nb\r\nc')
  })

  it('Unix 行尾为档案时不做变换(输入即序列化器的 LF 输出)', () => {
    expect(applyEol('a\nb', '\n')).toBe('a\nb')
  })
})
