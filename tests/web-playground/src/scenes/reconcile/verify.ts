import { assert, assertEqual } from '../../oracle/checks'
import type { CheckOutcome } from '../../oracle/types'
import type { ClaimStatus, ExpenseClaim } from './types'

export const PAGE1_EXPECTATIONS: Array<{
  id: string
  status: ClaimStatus
  actualAmount?: number
}> = [
  { id: 'CLM-2026-001', status: 'matched' },
  { id: 'CLM-2026-002', status: 'discrepancy', actualAmount: 3800 },
  { id: 'CLM-2026-003', status: 'matched' },
  { id: 'CLM-2026-004', status: 'missing' },
  { id: 'CLM-2026-005', status: 'matched' },
  { id: 'CLM-2026-006', status: 'matched' },
]

export interface ReconcileSnapshot {
  claims: ExpenseClaim[]
  page1Submitted: boolean
}

function statusLabel(status: ClaimStatus): string {
  switch (status) {
    case 'matched':
      return '核销通过'
    case 'discrepancy':
      return '金额异常'
    case 'missing':
      return '流水缺失'
    case 'archived':
      return '已归档'
    default:
      return '待核验'
  }
}

export function verifyReconcile(snapshot: ReconcileSnapshot): CheckOutcome[] {
  const outcomes: CheckOutcome[] = PAGE1_EXPECTATIONS.map((expected) => {
    const claim = snapshot.claims.find((item) => item.id === expected.id)
    if (!claim) {
      return assert(expected.id, `${expected.id} 状态`, false, statusLabel(expected.status), '单据不存在')
    }

    const statusOk = claim.status === expected.status
    const amountOk =
      expected.actualAmount == null || claim.actualAmount === expected.actualAmount
    const noteOk = expected.status !== 'discrepancy' || claim.reviewNote.trim().length > 0
    const ok = statusOk && amountOk && noteOk

    const expectedText =
      expected.actualAmount != null
        ? `${statusLabel(expected.status)} / ${expected.actualAmount}`
        : statusLabel(expected.status)
    const actualText =
      expected.actualAmount != null
        ? `${statusLabel(claim.status)} / ${claim.actualAmount ?? '无金额'}`
        : statusLabel(claim.status)

    return assert(expected.id, `${expected.id} ${expectedText}`, ok, expectedText, actualText)
  })

  outcomes.push(
    assertEqual('submitted', '已提交第 1 页核销结果', true, snapshot.page1Submitted),
  )
  return outcomes
}
