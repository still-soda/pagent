<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSceneOracle } from '../../oracle'
import { PAGE1_EXPECTATIONS, verifyReconcile } from './verify'
import {
  Check,
  Close,
  DocumentChecked,
  Search,
  TopRight,
} from '@element-plus/icons-vue'
import { mockClaims } from './data'
import type { ClaimStatus, ExpenseClaim } from './types'

/* ---------- 报销单核心数据 ---------- */
const claims = reactive<ExpenseClaim[]>(JSON.parse(JSON.stringify(mockClaims)))

/* ---------- 筛选与分页 ---------- */
const statusFilter = ref<string>('all')
const departmentFilter = ref<string>('all')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(6)

const filteredClaims = computed(() => {
  return claims.filter((c) => {
    if (statusFilter.value !== 'all' && c.status !== statusFilter.value) return false
    if (departmentFilter.value !== 'all' && c.department !== departmentFilter.value) return false
    if (
      searchKeyword.value.trim() &&
      !c.id.toLowerCase().includes(searchKeyword.value.trim().toLowerCase()) &&
      !c.applicant.includes(searchKeyword.value.trim()) &&
      !c.txnId.toLowerCase().includes(searchKeyword.value.trim().toLowerCase())
    ) {
      return false
    }
    return true
  })
})

const paginatedClaims = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredClaims.value.slice(start, start + pageSize.value)
})

/* ---------- 单据核验操作 ---------- */
function markMatched(item: ExpenseClaim) {
  item.status = 'matched'
  item.actualAmount = item.claimAmount
  item.reviewNote = '银行对公流水金额与单据完全一致，核验无误'
  ElMessage.success(`单据【${item.id}】已标记为核销通过`)
}

function markMissing(item: ExpenseClaim) {
  item.status = 'missing'
  item.actualAmount = 0
  item.reviewNote = '银行流水台未检索到该关联流水号，挂起待查'
  ElMessage.warning(`单据【${item.id}】标记为流水缺失`)
}

/* 差异记录弹窗 */
const discrepancyDialogVisible = ref(false)
const activeDiscrepancyItem = ref<ExpenseClaim | null>(null)
const actualAmountInput = ref<number>(3800.0)
const discrepancyReasonInput = ref('')

function openDiscrepancyDialog(item: ExpenseClaim) {
  activeDiscrepancyItem.value = item
  actualAmountInput.value = item.actualAmount ?? 3800.0
  discrepancyReasonInput.value = item.reviewNote || '发票申报 4200 元，流水实付 3800 元（剔除 400 元进项税差异）'
  discrepancyDialogVisible.value = true
}

function saveDiscrepancy() {
  if (!activeDiscrepancyItem.value) return
  activeDiscrepancyItem.value.status = 'discrepancy'
  activeDiscrepancyItem.value.actualAmount = Number(actualAmountInput.value)
  activeDiscrepancyItem.value.reviewNote = discrepancyReasonInput.value.trim()
  discrepancyDialogVisible.value = false
  ElMessage.warning(`单据【${activeDiscrepancyItem.value.id}】已记录金额差异`)
}

/* ---------- 跨标签页 / 分屏视窗 ---------- */
const splitViewOpen = ref(false)

function openBankTab() {
  window.open('/reconcile/statement', '_blank')
}

/* ---------- 批量提交 ---------- */
const page1Submitted = ref(false)
const page1Ids = PAGE1_EXPECTATIONS.map((item) => item.id)

function submitCurrentPage() {
  const unreviewed = paginatedClaims.value.filter((c) => c.status === 'pending')
  if (unreviewed.length > 0) {
    ElMessage.error(`当前页仍有 ${unreviewed.length} 笔单据处于「待核验」状态，请核对完成后再提交！`)
    return
  }

  if (page1Ids.every((id) => paginatedClaims.value.some((claim) => claim.id === id))) {
    page1Submitted.value = true
  }

  ElMessage.success(`第 ${currentPage.value} 页对账结果已成功批量归档！`)
}

function resetReconcile() {
  claims.splice(0, claims.length, ...JSON.parse(JSON.stringify(mockClaims)))
  statusFilter.value = 'all'
  departmentFilter.value = 'all'
  searchKeyword.value = ''
  currentPage.value = 1
  splitViewOpen.value = false
  discrepancyDialogVisible.value = false
  activeDiscrepancyItem.value = null
  page1Submitted.value = false
}

useSceneOracle('reconcile', {
  verify: () =>
    verifyReconcile({
      claims,
      page1Submitted: page1Submitted.value,
    }),
  reset: resetReconcile,
})

function statusTag(status: ClaimStatus) {
  switch (status) {
    case 'matched': return { type: 'success', text: '核销通过' }
    case 'discrepancy': return { type: 'danger', text: '金额异常' }
    case 'missing': return { type: 'warning', text: '流水缺失' }
    case 'archived': return { type: 'info', text: '已归档' }
    default: return { type: 'info', text: '待核验' }
  }
}
</script>

<template>
  <div class="reconcile-workbench" :class="{ 'with-split': splitViewOpen }">
    <div class="erp-container">
      <header class="erp-top">
        <div class="crumb">
          <el-icon :size="14"><DocumentChecked /></el-icon>
          财务中心 / 费用报销 / 银行对账
        </div>
      </header>

      <div class="period-bar">
        <span>账期 2026-09</span>
        <span>批次 第一批</span>
        <span>共 {{ claims.length }} 笔</span>
        <span>待核验 {{ claims.filter((c) => c.status === 'pending').length }}</span>
        <span class="warn">金额异常 {{ claims.filter((c) => c.status === 'discrepancy').length }}</span>
        <span class="warn">流水缺失 {{ claims.filter((c) => c.status === 'missing').length }}</span>
      </div>

      <div class="filter-toolbar">
        <el-radio-group v-model="statusFilter" size="small">
          <el-radio-button label="all">全部</el-radio-button>
          <el-radio-button label="pending">待核验</el-radio-button>
          <el-radio-button label="matched">已通过</el-radio-button>
          <el-radio-button label="discrepancy">金额异常</el-radio-button>
          <el-radio-button label="missing">流水缺失</el-radio-button>
        </el-radio-group>
        <el-select v-model="departmentFilter" size="small" style="width: 132px">
          <el-option label="全部部门" value="all" />
          <el-option label="技术研发部" value="技术研发部" />
          <el-option label="市场公关部" value="市场公关部" />
          <el-option label="产品设计部" value="产品设计部" />
          <el-option label="商业化团队" value="商业化团队" />
          <el-option label="综合行政部" value="综合行政部" />
        </el-select>
        <el-input
          v-model="searchKeyword"
          placeholder="搜索单号/申请人/流水号..."
          :prefix-icon="Search"
          size="small"
          clearable
          style="width: 200px"
        />
        <el-button id="btn-open-bank-tab" type="primary" size="small" :icon="TopRight" @click="openBankTab">
          在新标签页打开银行流水台
        </el-button>
        <el-switch v-model="splitViewOpen" active-text="分屏" inactive-text="单屏" />
      </div>

      <div class="table-wrap">
        <el-table :data="paginatedClaims" border size="small" style="width: 100%" height="100%">
          <el-table-column prop="id" label="报销单号" width="128">
            <template #default="{ row }">
              <span class="code">{{ row.id }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="applicant" label="申请人" width="84" />
          <el-table-column prop="department" label="部门" width="110" />
          <el-table-column prop="reason" label="事由" min-width="160" />
          <el-table-column prop="invoiceNo" label="发票号" width="150">
            <template #default="{ row }">
              <span class="code muted">{{ row.invoiceNo }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="txnId" label="银行流水号" width="120">
            <template #default="{ row }">
              <span class="code txn">{{ row.txnId }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="claimAmount" label="申报金额" width="110" align="right">
            <template #default="{ row }">
              <span class="amt">{{ row.claimAmount.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="92" align="center">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.status).type" size="small">
                {{ statusTag(row.status).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="actualAmount" label="流水实付" width="110" align="right">
            <template #default="{ row }">
              <span v-if="row.actualAmount !== null" class="amt" :class="{ danger: row.status === 'discrepancy' }">
                {{ row.actualAmount.toFixed(2) }}
              </span>
              <span v-else class="muted">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="reviewNote" label="核验备注" min-width="180">
            <template #default="{ row }">
              <span class="note">{{ row.reviewNote || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button type="success" link size="small" :disabled="row.status === 'matched'" @click="markMatched(row)">
                通过
              </el-button>
              <el-button type="danger" link size="small" @click="openDiscrepancyDialog(row)">
                标记异常
              </el-button>
              <el-button type="warning" link size="small" :disabled="row.status === 'missing'" @click="markMissing(row)">
                流水缺失
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredClaims.length"
          layout="prev, pager, next, total"
          small
        />
        <el-button id="btn-submit-page" type="primary" size="small" :icon="Check" @click="submitCurrentPage">
          提交当页核销结果
        </el-button>
      </div>
    </div>

    <div v-if="splitViewOpen" class="split-pane">
      <div class="split-header">
        <span>招行对公流水</span>
        <el-button size="small" link :icon="Close" @click="splitViewOpen = false" />
      </div>
      <iframe src="/reconcile/statement" class="split-frame" title="Bank Statement Frame" />
    </div>

    <el-dialog
      v-model="discrepancyDialogVisible"
      title="记录金额核对异常"
      width="460px"
    >
      <div v-if="activeDiscrepancyItem" class="dialog-content">
        <p class="dialog-tip">
          单据【{{ activeDiscrepancyItem.id }}】申报金额为 <b>¥ {{ activeDiscrepancyItem.claimAmount.toFixed(2) }}</b>，
          请填入银行流水中查实的打款金额及差额原因：
        </p>
        <el-form label-position="top">
          <el-form-item label="银行流水实付金额 (元)">
            <el-input-number
              v-model="actualAmountInput"
              :precision="2"
              :step="50"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="差异原因说明">
            <el-input
              v-model="discrepancyReasonInput"
              type="textarea"
              :rows="3"
              placeholder="如：发票申报 4200 元，流水实付 3800 元（剔除 400 元进项税差异）"
            />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <el-button @click="discrepancyDialogVisible = false">取消</el-button>
        <el-button id="btn-save-discrepancy" type="danger" @click="saveDiscrepancy">
          确认记录异常
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.reconcile-workbench {
  display: flex;
  height: 100%;
  background: #eef1f6;
}

.erp-container {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.erp-top {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  background: #1d4f91;
  color: #fff;
  font-size: 13px;
}

.crumb {
  display: flex;
  align-items: center;
  gap: 6px;
}

.period-bar {
  display: flex;
  gap: 16px;
  padding: 6px 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #d9dee8;
  font-size: 12px;
  color: #4b5563;
}

.period-bar .warn {
  color: #b45309;
}

.filter-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  background: #fff;
}

.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.txn {
  color: #1d4f91;
}

.amt {
  font-variant-numeric: tabular-nums;
}

.amt.danger,
.danger {
  color: #b91c1c;
  font-weight: 600;
}

.muted {
  color: #9ca3af;
}

.note {
  font-size: 12px;
  color: #4b5563;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
}

.split-pane {
  width: 46%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #cfd6e4;
  background: #fff;
}

.split-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
}

.split-frame {
  flex: 1;
  width: 100%;
  border: none;
}

.dialog-tip {
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 12px;
}
</style>
