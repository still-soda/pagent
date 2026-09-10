import { assert } from '../../oracle/checks'
import type { CheckOutcome } from '../../oracle/types'
import type { ConditionGroup, ConditionRule, PivotAggregateRow } from './types'

export interface BiSnapshot {
  tree: ConditionGroup
  calculated: boolean
  pivotRows: PivotAggregateRow[]
  selectedCategory: string | null
  exported: boolean
}

function collectGroups(group: ConditionGroup): ConditionGroup[] {
  const groups = [group]
  for (const child of group.children) {
    if (child.type === 'group') groups.push(...collectGroups(child))
  }
  return groups
}

function ruleMatches(
  rule: ConditionRule,
  field: ConditionRule['field'],
  operator: ConditionRule['operator'],
  value: string | number,
): boolean {
  if (rule.field !== field || rule.operator !== operator) return false
  if (typeof value === 'number') return Number(rule.value) === value
  return String(rule.value) === value
}

function groupHasRule(
  group: ConditionGroup,
  field: ConditionRule['field'],
  operator: ConditionRule['operator'],
  value: string | number,
): boolean {
  return group.children.some(
    (child) => child.type === 'rule' && ruleMatches(child, field, operator, value),
  )
}

export function verifyBiBuilder(snapshot: BiSnapshot): CheckOutcome[] {
  const root = snapshot.tree
  const nestedOr = collectGroups(root).find(
    (group) =>
      group.id !== root.id &&
      group.logicalOperator === 'OR' &&
      groupHasRule(group, 'returnRate', 'gt', 10) &&
      groupHasRule(group, 'complaints', 'gte', 3),
  )
  const topCategory = snapshot.pivotRows[0]?.category ?? null

  return [
    assert(
      'root-and',
      '顶层条件组为 AND，且含线上自营与客单价 > 500',
      root.logicalOperator === 'AND' &&
        groupHasRule(root, 'channel', 'eq', '线上自营') &&
        groupHasRule(root, 'orderAmount', 'gt', 500),
      'AND / 线上自营 / >500',
      `${root.logicalOperator} / ${root.children.length} 个子条件`,
    ),
    assert(
      'nested-or',
      '存在 OR 子组：退货率 > 10 或 客诉 >= 3',
      nestedOr != null,
      'OR 子组含退货率与客诉',
      nestedOr ? '已匹配' : '未找到目标子组',
    ),
    assert('calculated', '已执行多维透视计算', snapshot.calculated, '已计算', snapshot.calculated ? '已计算' : '未计算'),
    assert(
      'drilldown',
      '已展开退货率最高品类的异常明细',
      Boolean(topCategory && snapshot.selectedCategory === topCategory),
      topCategory ?? '需先完成透视',
      snapshot.selectedCategory ?? '未下钻',
    ),
    assert('exported', '已导出异常明细报表', snapshot.exported, '已导出', snapshot.exported ? '已导出' : '未导出'),
  ]
}
