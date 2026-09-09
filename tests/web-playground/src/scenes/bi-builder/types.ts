export type CategoryType = '3C数码' | '家居日用' | '服饰箱包' | '食品生鲜' | '美妆个护'
export type ChannelType = '线上自营' | '线下加盟' | '跨境专区'
export type RegionType = '华东' | '华南' | '华北' | '西南'

export interface MerchantMetricRecord {
  id: string
  merchantName: string
  category: CategoryType
  subCategory: string
  channel: ChannelType
  region: RegionType
  orderCount: number
  gmv: number // 销售额
  returnRate: number // 退货率 %
  complaints: number // 客诉数
  grossMargin: number // 毛利率 %
  topRiskSku: string
}

export interface ConditionRule {
  id: string
  type: 'rule'
  field: 'channel' | 'orderAmount' | 'returnRate' | 'complaints' | 'region' | 'grossMargin'
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  value: string | number
}

export interface ConditionGroup {
  id: string
  type: 'group'
  logicalOperator: 'AND' | 'OR'
  children: Array<ConditionRule | ConditionGroup>
}

export interface PivotAggregateRow {
  category: string
  matchCount: number
  totalGmv: number
  avgOrderGmv: number
  avgReturnRate: number
  totalComplaints: number
  avgGrossMargin: number
  riskLevel: '高' | '中' | '低'
  records: MerchantMetricRecord[]
}
