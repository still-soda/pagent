export type DepartmentType =
  | '技术研发部'
  | '市场公关部'
  | '产品设计部'
  | '商业化团队'
  | '综合行政部'
  | '供应链与仓储部'

export type ClaimStatus = 'pending' | 'matched' | 'discrepancy' | 'missing' | 'archived'

export interface ExpenseClaim {
  id: string
  applicant: string
  department: DepartmentType
  expenseCategory: string
  reason: string
  txnId: string
  claimAmount: number
  invoiceNo: string
  actualAmount: number | null
  status: ClaimStatus
  reviewNote: string
  submitDate: string
}

export interface BankTransaction {
  txnId: string
  bookingTime: string
  counterparty: string
  accountNo: string
  direction: '支出' | '收入'
  amount: number
  fee: number
  purpose: string
  voucherNo: string
}
