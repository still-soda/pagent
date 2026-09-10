import { assert } from '../../oracle/checks'
import type { CheckOutcome } from '../../oracle/types'
import type { KanbanColumn } from './types'

export const SETTLEMENT_CARD_ID = 'TASK-1082'
export const SETTLEMENT_DEPENDENCY = '基础支付服务 v2.4.0'

export interface KanbanSnapshot {
  columns: KanbanColumn[]
  filterAssignee: string
}

export function findCard(columns: KanbanColumn[], cardId: string) {
  for (const column of columns) {
    const index = column.cards.findIndex((card) => card.id === cardId)
    if (index >= 0) {
      return { column, index, card: column.cards[index] }
    }
  }
  return null
}

export function verifyKanban(snapshot: KanbanSnapshot): CheckOutcome[] {
  const located = findCard(snapshot.columns, SETTLEMENT_CARD_ID)
  const atAcceptanceTop =
    located?.column.id === 'acceptance' && located.index === 0
  const hasDep = Boolean(
    located?.card.dependencies.some((item) => item.includes(SETTLEMENT_DEPENDENCY)),
  )

  return [
    assert(
      'moved',
      '「结算中心重构」已置于待验收列最上方',
      atAcceptanceTop,
      'acceptance[0]',
      located
        ? `${located.column.id}[${located.index}]`
        : '未找到卡片',
    ),
    assert(
      'dependency',
      '阻塞依赖包含「基础支付服务 v2.4.0」',
      hasDep,
      SETTLEMENT_DEPENDENCY,
      located?.card.dependencies.join('、') || '无',
    ),
    assert(
      'filter',
      '责任人筛选为林工',
      snapshot.filterAssignee === '林工',
      '林工',
      snapshot.filterAssignee || '未筛选',
    ),
  ]
}
