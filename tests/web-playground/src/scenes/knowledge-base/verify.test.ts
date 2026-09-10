import { describe, expect, it } from 'vitest'
import { BRIEFING_TITLE, verifyKnowledgeBase } from './verify'
import type { SavedDoc } from './types'

function doc(overrides: Partial<SavedDoc> = {}): SavedDoc {
  return {
    id: 'doc-1',
    title: BRIEFING_TITLE,
    tags: ['评审', '3.0'],
    html: '<p>概述</p>',
    text: '概述发布节奏。Q3 DAU 与 NPS。API 停服。风险与决策。行动项负责人截止。Q4 预算。',
    wordCount: 80,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('verifyKnowledgeBase', () => {
  it('keeps browsing as unknown and fails when no briefing exists', () => {
    const outcomes = verifyKnowledgeBase({ docs: [] })
    expect(outcomes.find((item) => item.id === 'browse')?.status).toBe('unknown')
    expect(outcomes.find((item) => item.id === 'title')?.status).toBe('fail')
  })

  it('accepts a title prefix and heuristic body coverage', () => {
    const outcomes = verifyKnowledgeBase({
      docs: [doc({ title: `内部 · ${BRIEFING_TITLE}` })],
    })
    expect(outcomes.find((item) => item.id === 'title')?.status).toBe('pass')
    expect(outcomes.find((item) => item.id === 'tags')?.status).toBe('pass')
    expect(outcomes.find((item) => item.id === 'budget')?.status).toBe('pass')
  })
})
