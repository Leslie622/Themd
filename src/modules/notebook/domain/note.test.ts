import { describe, expect, it } from 'vitest'
import { deriveTitle } from './note'

describe('deriveTitle', () => {
  it('prefers the first markdown heading', () => {
    expect(deriveTitle('intro\n# Project title\nbody')).toBe('Project title')
  })

  it('falls back to the first non-empty non-image line', () => {
    expect(deriveTitle('\n![cover](data:image/png;base64,abc)\nA useful note')).toBe('A useful note')
  })
})
