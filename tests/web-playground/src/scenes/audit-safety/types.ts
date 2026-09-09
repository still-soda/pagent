export type DisputeType =
  | '7天无理由退货'
  | '商品外观划痕争议'
  | '假冒品牌鉴定争议'
  | '未按约定时间发货'
  | '少件/空包裹争议'

export interface DisputeTicket {
  id: string
  orderId: string
  buyerId: string
  buyerName: string
  buyerCreditScore: number // 0-100
  disputeType: DisputeType
  orderAmount: number
  appliedTime: string
  status: 'pending_review' | 'in_review' | 'resolved'
  priority: 'urgent' | 'normal'
  timeoutHours: number
}

export interface ChatMessage {
  id: string
  sender: 'buyer' | 'merchant' | 'bot' | 'system'
  senderName: string
  timestamp: string
  content: string
  attachmentName?: string
}

export interface LogisticsNode {
  time: string
  title: string
  location: string
  isHighlight?: boolean
}
