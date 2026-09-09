<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CopyDocument,
  Download,
  Money,
  Printer,
  Search,
} from '@element-plus/icons-vue'
import { mockBankTransactions } from './data'
import type { BankTransaction } from './types'

const transactions = reactive<BankTransaction[]>(JSON.parse(JSON.stringify(mockBankTransactions)))
const filterSearch = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const filteredTransactions = computed(() => {
  if (!filterSearch.value.trim()) return transactions
  const q = filterSearch.value.trim().toLowerCase()
  return transactions.filter(
    (t) =>
      t.txnId.toLowerCase().includes(q) ||
      t.counterparty.toLowerCase().includes(q) ||
      t.purpose.toLowerCase().includes(q),
  )
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredTransactions.value.slice(start, start + pageSize.value)
})

function copyTxnId(id: string) {
  navigator.clipboard.writeText(id)
  ElMessage.success(`流水号【${id}】已复制到剪贴板`)
}
</script>

<template>
  <div class="bank-portal">
    <header class="bank-header">
      <div class="bank-brand">
        <div class="bank-logo">
          <el-icon :size="20"><Money /></el-icon>
        </div>
        <div class="bank-title-group">
          <h2>招商银行 · 企业对公金融服务台</h2>
          <span class="sub">China Merchants Bank Corporate Banking | 对公账户流水直通平台</span>
        </div>
      </div>
      <div class="bank-account-info">
        <span class="account-tag">账户：星澜云端智能（杭州）有限公司</span>
        <span class="account-number">账号：5719 **** **** 0801</span>
      </div>
    </header>

    <main class="bank-main">
      <div class="statement-card">
        <div class="statement-toolbar">
          <div class="query-box">
            <span class="query-label">
              <el-icon :size="14"><Search /></el-icon>
              交易检索：
            </span>
            <el-input
              v-model="filterSearch"
              placeholder="输入流水号 (如 TXN-8901) 或对手方户名..."
              clearable
              style="width: 320px"
              size="small"
            />
          </div>
          <div class="toolbar-actions">
            <el-button size="small" :icon="Download">导出流水报表</el-button>
            <el-button size="small" :icon="Printer">打印对账单</el-button>
          </div>
        </div>

        <div class="summary-bar">
          <div class="summary-item">
            <span class="k">全量流水总笔数</span>
            <span class="v">{{ transactions.length }} 笔</span>
          </div>
          <div class="summary-item">
            <span class="k">检索结果笔数</span>
            <span class="v text-primary">{{ filteredTransactions.length }} 笔</span>
          </div>
          <div class="summary-item">
            <span class="k">本期借记支出累计</span>
            <span class="v text-danger">¥ {{ filteredTransactions.reduce((acc, c) => acc + c.amount, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}</span>
          </div>
          <div class="summary-item">
            <span class="k">结算账户可用余额</span>
            <span class="v text-success">¥ 2,854,920.00</span>
          </div>
        </div>

        <el-table :data="paginatedData" stripe border style="width: 100%">
          <el-table-column prop="txnId" label="交易流水号" width="140">
            <template #default="{ row }">
              <div class="txn-cell">
                <span class="txn-code">{{ row.txnId }}</span>
                <button
                  type="button"
                  class="btn-copy"
                  title="复制流水号"
                  @click="copyTxnId(row.txnId)"
                >
                  <el-icon :size="12"><CopyDocument /></el-icon>
                </button>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="bookingTime" label="记账时间" width="170" />
          <el-table-column prop="counterparty" label="对方户名 / 结算方" min-width="200" />

          <el-table-column prop="direction" label="收支方向" width="90">
            <template #default="{ row }">
              <el-tag :type="row.direction === '支出' ? 'danger' : 'success'" size="small">
                {{ row.direction }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="amount" label="交易金额 (元)" width="130" align="right">
            <template #default="{ row }">
              <span class="amount-cell">¥ {{ row.amount.toFixed(2) }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="purpose" label="交易用途 / 凭证附言" min-width="200" />
          <el-table-column prop="voucherNo" label="银行凭证号" width="160" />
        </el-table>

        <div class="bank-pagination">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="filteredTransactions.length"
            layout="prev, pager, next, total"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.bank-portal {
  min-height: 100vh;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}

.bank-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  background: #b81c22;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.bank-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.bank-logo {
  width: 36px;
  height: 36px;
  background: #fff;
  border-radius: 50%;
  color: #b81c22;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bank-title-group h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #fff;
}

.bank-title-group .sub {
  font-size: 11px;
  opacity: 0.85;
}

.bank-account-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  font-size: 12px;
  opacity: 0.95;
}

.bank-main {
  flex: 1;
  padding: 20px 28px;
}

.statement-card {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.statement-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.query-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.query-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.summary-bar {
  display: flex;
  gap: 24px;
  padding: 12px 18px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 16px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.summary-item .k {
  font-size: 12px;
  color: #888;
}

.summary-item .v {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.text-danger {
  color: #f56c6c !important;
}
.text-success {
  color: #67c23a !important;
}
.text-primary {
  color: #409eff !important;
}

.txn-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.txn-code {
  font-family: monospace;
  font-weight: 600;
  color: #b81c22;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: transparent;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  color: #606266;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy:hover {
  border-color: #b81c22;
  color: #b81c22;
}

.amount-cell {
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
}

.bank-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
