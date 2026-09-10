<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CopyDocument,
  Download,
  Printer,
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
      <div class="brand">
        <span class="logo">招</span>
        <div>
          <strong>招商银行企业银行</strong>
          <em>网上企业银行</em>
        </div>
      </div>
      <div class="acct">
        <span>星澜云端智能（杭州）有限公司</span>
        <span>5719 **** **** 0801</span>
      </div>
    </header>

    <div class="subbar">
      <span>账户查询</span>
      <span class="on">交易明细</span>
      <span>电子回单</span>
    </div>

    <main class="bank-main">
      <div class="query-row">
        <label>
          流水号 / 对方户名
          <el-input
            v-model="filterSearch"
            placeholder="输入流水号 (如 TXN-8901) 或对手方户名..."
            clearable
            size="small"
            style="width: 280px"
          />
        </label>
        <div class="query-actions">
          <el-button size="small" :icon="Download">导出</el-button>
          <el-button size="small" :icon="Printer">打印</el-button>
        </div>
      </div>

      <div class="bal-row">
        <span>笔数 {{ filteredTransactions.length }}/{{ transactions.length }}</span>
        <span>
          支出合计
          {{ filteredTransactions.reduce((acc, c) => acc + c.amount, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
        </span>
        <span>可用余额 2,854,920.00</span>
      </div>

      <el-table :data="paginatedData" border size="small" style="width: 100%">
        <el-table-column prop="txnId" label="交易流水号" width="140">
          <template #default="{ row }">
            <div class="txn-cell">
              <span class="txn-code">{{ row.txnId }}</span>
              <button type="button" class="btn-copy" title="复制流水号" @click="copyTxnId(row.txnId)">
                <el-icon :size="12"><CopyDocument /></el-icon>
              </button>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="bookingTime" label="记账时间" width="168" />
        <el-table-column prop="counterparty" label="对方户名" min-width="180" />
        <el-table-column prop="direction" label="借贷" width="72">
          <template #default="{ row }">
            <span :class="row.direction === '支出' ? 'out' : 'in'">{{ row.direction }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amt">{{ row.amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="purpose" label="用途" min-width="180" />
        <el-table-column prop="voucherNo" label="凭证号" width="150" />
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredTransactions.length"
          layout="prev, pager, next, total"
          small
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.bank-portal {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
}

.bank-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px;
  background: #c41230;
  color: #fff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  width: 28px;
  height: 28px;
  background: #fff;
  color: #c41230;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.brand strong {
  display: block;
  font-size: 14px;
}

.brand em {
  font-style: normal;
  font-size: 11px;
  opacity: 0.85;
}

.acct {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 12px;
}

.subbar {
  display: flex;
  gap: 18px;
  padding: 0 16px;
  height: 36px;
  align-items: center;
  background: #9f1027;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.subbar .on {
  color: #fff;
  font-weight: 600;
  border-bottom: 2px solid #ffd27a;
  height: 36px;
  display: inline-flex;
  align-items: center;
}

.bank-main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #fff;
  padding: 12px 16px;
}

.query-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.query-row label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4b5563;
}

.bal-row {
  display: flex;
  gap: 20px;
  margin-bottom: 10px;
  padding: 6px 8px;
  background: #fff8f0;
  border: 1px solid #f3d7b3;
  font-size: 12px;
  color: #7c2d12;
}

.txn-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.txn-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #c41230;
  font-size: 12px;
}

.btn-copy {
  width: 20px;
  height: 20px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
}

.amt {
  font-variant-numeric: tabular-nums;
}

.out {
  color: #c41230;
}

.in {
  color: #047857;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
