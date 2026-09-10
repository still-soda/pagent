import { describe, expect, it } from 'vitest'
import { verifyBiBuilder } from './verify'
import type { ConditionGroup, PivotAggregateRow } from './types'

function targetTree(): ConditionGroup {
  return {
    id: 'root-group',
    type: 'group',
    logicalOperator: 'AND',
    children: [
      { id: 'r1', type: 'rule', field: 'channel', operator: 'eq', value: '线上自营' },
      { id: 'r2', type: 'rule', field: 'orderAmount', operator: 'gt', value: 500 },
      {
        id: 'g1',
        type: 'group',
        logicalOperator: 'OR',
        children: [
          { id: 'r3', type: 'rule', field: 'returnRate', operator: 'gt', value: 10 },
          { id: 'r4', type: 'rule', field: 'complaints', operator: 'gte', value: 3 },
        ],
      },
    ],
  }
}

const topRow = {
  category: '服饰箱包',
  matchCount: 2,
  totalGmv: 1,
  avgOrderGmv: 1,
  avgReturnRate: 20,
  totalComplaints: 4,
  avgGrossMargin: 10,
  riskLevel: '高',
  records: [],
} as PivotAggregateRow

describe('verifyBiBuilder', () => {
  it('fails the default empty tree', () => {
    const outcomes = verifyBiBuilder({
      tree: {
        id: 'root-group',
        type: 'group',
        logicalOperator: 'AND',
        children: [],
      },
      calculated: false,
      pivotRows: [],
      selectedCategory: null,
      exported: false,
    })
    expect(outcomes.find((item) => item.id === 'nested-or')?.status).toBe('fail')
    expect(outcomes.find((item) => item.id === 'exported')?.status).toBe('fail')
  })

  it('passes when the nested OR group, pivot, drilldown and export are done', () => {
    const outcomes = verifyBiBuilder({
      tree: targetTree(),
      calculated: true,
      pivotRows: [topRow],
      selectedCategory: '服饰箱包',
      exported: true,
    })
    expect(outcomes.every((item) => item.status === 'pass')).toBe(true)
  })
})
