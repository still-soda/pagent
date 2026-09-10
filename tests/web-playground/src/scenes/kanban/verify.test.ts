import { describe, expect, it } from 'vitest'
import { initialKanbanColumns } from './data'
import { SETTLEMENT_CARD_ID, SETTLEMENT_DEPENDENCY, findCard, verifyKanban } from './verify'
import type { KanbanColumn } from './types'

function cloneColumns(): KanbanColumn[] {
  return JSON.parse(JSON.stringify(initialKanbanColumns))
}

describe('verifyKanban', () => {
  it('fails on the initial board', () => {
    const outcomes = verifyKanban({ columns: cloneColumns(), filterAssignee: '' })
    expect(outcomes.every((item) => item.status === 'fail')).toBe(true)
  })

  it('passes when the settlement card is top of acceptance with dependency and filter', () => {
    const columns = cloneColumns()
    const located = findCard(columns, SETTLEMENT_CARD_ID)
    expect(located).not.toBeNull()
    if (!located) return
    located.column.cards.splice(located.index, 1)
    const acceptance = columns.find((column) => column.id === 'acceptance')
    located.card.dependencies.push(SETTLEMENT_DEPENDENCY)
    acceptance?.cards.unshift(located.card)

    const outcomes = verifyKanban({ columns, filterAssignee: '林工' })
    expect(outcomes.every((item) => item.status === 'pass')).toBe(true)
  })
})
