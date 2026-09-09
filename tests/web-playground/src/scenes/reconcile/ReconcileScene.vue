<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
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
function submitCurrentPage() {
  const unreviewed = paginatedClaims.value.filter((c) => c.status === 'pending')
  if (unreviewed.length > 0) {
    ElMessage.error(`当前页仍有 ${unreviewed.length} 笔单据处于「待核验」状态，请核对完成后再提交！`)
    return
  }

  ElMessage.success(`第 ${currentPage.value} 页对账结果已成功批量归档！`)
}

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
    <!-- 主界面：ERP 报销审核台 -->
    <div class="erp-container">
      <header class="erp-header-card">
        <div class="header-left">
          <div class="header-icon-box">
            <el-icon :size="20"><DocumentChecked /></el-icon>
          </div>
          <div class="header-title-box">
            <h2>星澜企业 ERP · 费用报销对账稽核台</h2>
            <span class="header-desc">
              对比招商银行对公账户交易流水，逐笔核验单据申报金额与流水号一致性（共 {{ claims.length }} 笔）
            </span>
          </div>
        </div>

        <div class="header-actions">
          <el-button
            id="btn-open-bank-tab"
            type="primary"
            :icon="TopRight"
            @click="openBankTab"
          >
            在新标签页打开银行流水台
          </el-button>
          <el-switch
            v-model="splitViewOpen"
            active-text="分屏比对视窗"
            inactive-text="单屏"
          />
        </div>
      </header>

      <!-- KPI 统计条 -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="lbl">全量费用报销工单</span>
          <span class="val">{{ claims.length }} 笔</span>
        </div>
        <div class="kpi-card">
          <span class="lbl">待核验待办单据</span>
          <span class="val text-primary">{{ claims.filter(c => c.status === 'pending').length }} 笔</span>
        </div>
        <div class="kpi-card">
          <span class="lbl">已识别金额差异</span>
          <span class="val text-danger">{{ claims.filter(c => c.status === 'discrepancy').length }} 笔</span>
        </div>
        <div class="kpi-card">
          <span class="lbl">流水缺失报警</span>
          <span class="val text-warning">{{ claims.filter(c => c.status === 'missing').length }} 笔</span>
        </div>
      </div>

      <!-- 筛选工具栏 -->
      <div class="filter-toolbar">
        <div class="filter-group">
          <span class="f-lbl">状态流转：</span>
          <el-radio-group v-model="statusFilter" size="small">
            <el-radio-button label="all">全部 ({{ claims.length }})</el-radio-button>
            <el-radio-button label="pending">待核验</el-radio-button>
            <el-radio-button label="matched">已通过</el-radio-button>
            <el-radio-button label="discrepancy">金额异常</el-radio-button>
            <el-radio-button label="missing">流水缺失</el-radio-button>
          </el-radio-group>
        </div>

        <div class="filter-group">
          <span class="f-lbl">所属部门：</span>
          <el-select v-model="departmentFilter" size="small" style="width: 140px">
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
        </div>
      </div>

      <!-- 报销单主表格 -->
      <div class="table-card">
        <el-table :data="paginatedClaims" stripe border style="width: 100%">
          <el-table-column prop="id" label="报销单号" width="135">
            <template #default="{ row }">
              <span class="code-font">{{ row.id }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="applicant" label="申请人" width="95" />
          <el-table-column prop="department" label="所属部门" width="120" />
          <el-table-column prop="reason" label="报销事由" min-width="170" />

          <el-table-column prop="invoiceNo" label="发票凭据号" width="150">
            <template #default="{ row }">
              <span class="code-font text-muted">{{ row.invoiceNo }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="txnId" label="关联银行流水号" width="135">
            <template #default="{ row }">
              <span class="code-font text-primary">{{ row.txnId }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="claimAmount" label="申报金额" width="115" align="right">
            <template #default="{ row }">
              <span class="amount-val">¥ {{ row.claimAmount.toFixed(2) }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="status" label="对账状态" width="105" align="center">
            <template #default="{ row }">
              <el-tag :type="statusTag(row.status).type" size="small">
                {{ statusTag(row.status).text }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="actualAmount" label="流水实付" width="115" align="right">
            <template #default="{ row }">
              <span v-if="row.actualAmount !== null" class="amount-val" :class="{ 'text-danger': row.status === 'discrepancy' }">
                ¥ {{ row.actualAmount.toFixed(2) }}
              </span>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>

          <el-table-column prop="reviewNote" label="核验备注 / 差异原因" min-width="190">
            <template #default="{ row }">
              <span class="note-text">{{ row.reviewNote || '—' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <div class="row-actions">
                <el-button
                  type="success"
                  link
                  size="small"
                  :disabled="row.status === 'matched'"
                  @click="markMatched(row)"
                >
                  通过
                </el-button>
                <el-button
                  type="danger"
                  link
                  size="small"
                  @click="openDiscrepancyDialog(row)"
                >
                  标记异常
                </el-button>
                <el-button
                  type="warning"
                  link
                  size="small"
                  :disabled="row.status === 'missing'"
                  @click="markMissing(row)"
                >
                  流水缺失
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="table-footer">
          <el-pagination
            v-model:current-page="currentPage"
            :page-size="pageSize"
            :total="filteredClaims.length"
            layout="prev, pager, next, total"
          />

          <div class="footer-actions">
            <el-button
              id="btn-submit-page"
              type="primary"
              :icon="Check"
              @click="submitCurrentPage"
            >
              提交当页核销结果
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分屏对比视窗 -->
    <div v-if="splitViewOpen" class="split-pane">
      <div class="split-header">
        <span>对公账户银行流水实时对比视窗</span>
        <el-button size="small" link :icon="Close" @click="splitViewOpen = false" />
      </div>
      <iframe src="/reconcile/statement" class="split-frame" title="Bank Statement Frame" />
    </div>

    <!-- 异常记录弹窗 -->
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
  padding: 16px;
  display: flex;
  gap: 16px;
  height: calc(100vh - 120px);
}

.with-split .erp-container {
  flex: 1;
  min-width: 0;
}

.erp-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}

.erp-header-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-title-box h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.header-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.kpi-card .lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.kpi-card .val {
  font-size: 18px;
  font-weight: 600;
}

.filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.f-lbl {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.table-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 16px;
}

.code-font {
  font-family: monospace;
  font-weight: 600;
}

.amount-val {
  font-family: monospace;
  font-weight: 600;
}

.note-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.row-actions {
  display: flex;
  gap: 8px;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.split-pane {
  width: 48%;
  background: #fff;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--el-box-shadow-light);
}

.split-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
  font-size: 13px;
  font-weight: 600;
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
