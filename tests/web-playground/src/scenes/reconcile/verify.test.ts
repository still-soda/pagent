import { describe, expect, it } from 'vitest'
import { mockClaims } from './data'
import { PAGE1_EXPECTATIONS, verifyReconcile } from './verify'
import type { ExpenseClaim } from './types'

function cloneClaims(): ExpenseClaim[] {
  return JSON.parse(JSON.stringify(mockClaims))
}

describe('verifyReconcile', () => {
  it('fails the default pending first page', () => {
    const outcomes = verifyReconcile({ claims: cloneClaims(), page1Submitted: false })
    expect(outcomes.every((item) => item.status === 'fail')).toBe(true)
  })

  it('passes when page 1 statuses match and the page was submitted', () => {
    const claims = cloneClaims()
    for (const expected of PAGE1_EXPECTATIONS) {
      const claim = claims.find((item) => item.id === expected.id)
      if (!claim) continue
      claim.status = expected.status
      if (expected.actualAmount != null) {
        claim.actualAmount = expected.actualAmount
        claim.reviewNote = '进项税差异'
      }
    }

    const outcomes = verifyReconcile({ claims, page1Submitted: true })
    expect(outcomes.every((item) => item.status === 'pass')).toBe(true)
  })
})
