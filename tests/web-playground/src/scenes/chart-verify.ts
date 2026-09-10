import { unknown } from '../oracle/checks'
import type { CheckOutcome } from '../oracle/types'

export function verifyChart(): CheckOutcome[] {
  const reason = '结论在对话里，页面无终态可判定'
  return [
    unknown('sales', '统计 2024 年线上商城总销售、订单量、客单价与在售产品数', reason),
    unknown('offline', '对比线下门店渠道销售额差异', reason),
    unknown('rank', '查询休闲运动鞋在服饰品类下的销售排名', reason),
    unknown('month', '找出 2024 年全渠道销售额最高的月份', reason),
    unknown('conclusion', '输出简短的分析结论', reason),
  ]
}
