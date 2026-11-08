import { describe, expect, it } from 'vitest'
import { ELEMENTS } from './elements'
import { FOCUSED_SAMPLES } from './element-samples'

/** 守门:每个元素组都必须有专注样例——缺样例时工场预览会静默退化成一行 label */
describe('FOCUSED_SAMPLES 覆盖全部元素', () => {
  it('ELEMENTS 的每个 id 都有样例且非空', () => {
    for (const el of ELEMENTS) {
      expect(FOCUSED_SAMPLES[el.id], `元素「${el.id}」缺专注样例`).toBeTruthy()
    }
  })
})
