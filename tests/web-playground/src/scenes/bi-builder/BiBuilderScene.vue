<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSceneOracle } from '../../oracle'
import { verifyBiBuilder } from './verify'
import {
  DataAnalysis,
  Delete,
  Download,
  Filter,
  Histogram,
  Plus,
} from '@element-plus/icons-vue'
import { mockOlapRecords } from './data'
import type {
  ConditionGroup,
  ConditionRule,
  MerchantMetricRecord,
  PivotAggregateRow,
} from './types'

let seedId = 200
function genId(): string {
  return `cond-${++seedId}`
}

function createInitialTree(): ConditionGroup {
  seedId = 200
  return {
    id: 'root-group',
    type: 'group',
    logicalOperator: 'AND',
    children: [],
  }
}

/* ---------- 条件树初始配置 ---------- */
const conditionTree = reactive<ConditionGroup>(createInitialTree())

const fieldOptions = [
  { label: '销售渠道', value: 'channel', type: 'string' },
  { label: '平均客单价 (元)', value: 'orderAmount', type: 'number' },
  { label: '退货率 (%)', value: 'returnRate', type: 'number' },
  { label: '客诉次数 (次)', value: 'complaints', type: 'number' },
  { label: '经营大区', value: 'region', type: 'string' },
  { label: '综合毛利率 (%)', value: 'grossMargin', type: 'number' },
]

const operatorOptions = [
  { label: '等于 (=)', value: 'eq' },
  { label: '不等于 (!=)', value: 'neq' },
  { label: '大于 (>)', value: 'gt' },
  { label: '大于等于 (>=)', value: 'gte' },
  { label: '小于 (<)', value: 'lt' },
  { label: '小于等于 (<=)', value: 'lte' },
]

function addRule(group: ConditionGroup) {
  group.children.push({
    id: genId(),
    type: 'rule',
    field: 'returnRate',
    operator: 'gt',
    value: 10,
  })
}

function addGroup(group: ConditionGroup) {
  group.children.push({
    id: genId(),
    type: 'group',
    logicalOperator: 'OR',
    children: [
      {
        id: genId(),
        type: 'rule',
        field: 'returnRate',
        operator: 'gt',
        value: 10,
      },
      {
        id: genId(),
        type: 'rule',
        field: 'complaints',
        operator: 'gte',
        value: 3,
      },
    ],
  })
}

function removeNode(parentGroup: ConditionGroup, childId: string) {
  parentGroup.children = parentGroup.children.filter((c) => c.id !== childId)
}

/* ---------- 树逻辑求值引擎 ---------- */
function evaluateRule(record: MerchantMetricRecord, rule: ConditionRule): boolean {
  let actualVal: string | number
  if (rule.field === 'orderAmount') {
    actualVal = Math.round(record.gmv / record.orderCount)
  } else {
    actualVal = record[rule.field]
  }

  const targetVal = rule.value

  if (typeof actualVal === 'string') {
    if (rule.operator === 'eq') return actualVal === String(targetVal)
    if (rule.operator === 'neq') return actualVal !== String(targetVal)
    return true
  }

  const nAct = Number(actualVal)
  const nTgt = Number(targetVal)
  switch (rule.operator) {
    case 'eq': return nAct === nTgt
    case 'neq': return nAct !== nTgt
    case 'gt': return nAct > nTgt
    case 'gte': return nAct >= nTgt
    case 'lt': return nAct < nTgt
    case 'lte': return nAct <= nTgt
    default: return true
  }
}

function evaluateGroup(record: MerchantMetricRecord, group: ConditionGroup): boolean {
  if (group.children.length === 0) return true
  if (group.logicalOperator === 'AND') {
    return group.children.every((child) =>
      child.type === 'rule' ? evaluateRule(record, child) : evaluateGroup(record, child),
    )
  } else {
    return group.children.some((child) =>
      child.type === 'rule' ? evaluateRule(record, child) : evaluateGroup(record, child),
    )
  }
}

/* ---------- 透视计算与下钻 ---------- */
const isCalculated = ref(false)
const pivotRows = ref<PivotAggregateRow[]>([])
const drawerOpen = ref(false)
const selectedCategory = ref<PivotAggregateRow | null>(null)

function runPivotAnalysis() {
  const matched = mockOlapRecords.filter((r) => evaluateGroup(r, conditionTree))

  const groupMap: Record<string, MerchantMetricRecord[]> = {}
  for (const item of matched) {
    if (!groupMap[item.category]) groupMap[item.category] = []
    groupMap[item.category].push(item)
  }

  const rows: PivotAggregateRow[] = Object.entries(groupMap).map(([cat, list]) => {
    const totalGmv = list.reduce((acc, c) => acc + c.gmv, 0)
    const totalOrders = list.reduce((acc, c) => acc + c.orderCount, 0)
    const avgOrderPrice = totalOrders > 0 ? Math.round(totalGmv / totalOrders) : 0
    const avgReturn = Math.round((list.reduce((acc, c) => acc + c.returnRate, 0) / list.length) * 10) / 10
    const totalComp = list.reduce((acc, c) => acc + c.complaints, 0)
    const avgMargin = Math.round((list.reduce((acc, c) => acc + c.grossMargin, 0) / list.length) * 10) / 10

    let risk: '高' | '中' | '低' = '低'
    if (avgReturn >= 15 || totalComp >= 8) risk = '高'
    else if (avgReturn >= 10 || totalComp >= 3) risk = '中'

    return {
      category: cat,
      matchCount: list.length,
      totalGmv,
      avgOrderGmv: avgOrderPrice,
      avgReturnRate: avgReturn,
      totalComplaints: totalComp,
      avgGrossMargin: avgMargin,
      riskLevel: risk,
      records: list,
    }
  })

  // 按退货率降序排列
  rows.sort((a, b) => b.avgReturnRate - a.avgReturnRate)
  pivotRows.value = rows
  isCalculated.value = true

  ElMessage.success(`透视计算完成！104 条明细中成功匹配 ${matched.length} 条商家经营记录，生成 ${rows.length} 个分析品类。`)
}

function openDrilldown(row: PivotAggregateRow) {
  selectedCategory.value = row
  drawerOpen.value = true
}

const exported = ref(false)

function exportExcel() {
  exported.value = true
  ElMessage.success(`已导出【${selectedCategory.value?.category}】异常商家明细报表 (.xlsx)`)
}

function resetBiBuilder() {
  const next = createInitialTree()
  conditionTree.id = next.id
  conditionTree.logicalOperator = next.logicalOperator
  conditionTree.children = next.children
  isCalculated.value = false
  pivotRows.value = []
  drawerOpen.value = false
  selectedCategory.value = null
  exported.value = false
}

useSceneOracle('bi-builder', {
  verify: () =>
    verifyBiBuilder({
      tree: conditionTree,
      calculated: isCalculated.value,
      pivotRows: pivotRows.value,
      selectedCategory: selectedCategory.value?.category ?? null,
      exported: exported.value,
    }),
  reset: resetBiBuilder,
})
</script>

<template>
  <div class="olap-workbench">
    <header class="bi-bar">
      <div class="dataset">
        <el-icon :size="14"><Histogram /></el-icon>
        商家经营明细
        <span>104 行 · 09-08 08:12 更新</span>
      </div>
      <el-button id="btn-execute-pivot" type="primary" size="small" :icon="DataAnalysis" @click="runPivotAnalysis">
        执行多维透视计算
      </el-button>
    </header>

    <section class="filter-panel">
      <div class="filter-head">
        <span>
          <el-icon :size="14"><Filter /></el-icon>
          筛选条件
        </span>
        <span class="hint">且/或可嵌套。先定渠道和客单价，再加退货或客诉。</span>
      </div>

      <div class="group root">
        <div class="group-bar">
          <el-radio-group v-model="conditionTree.logicalOperator" size="small">
            <el-radio-button label="AND">AND (必须全满足)</el-radio-button>
            <el-radio-button label="OR">OR (任一满足即可)</el-radio-button>
          </el-radio-group>
          <div class="group-btns">
            <el-button size="small" :icon="Plus" @click="addRule(conditionTree)">添加条件</el-button>
            <el-button
              id="btn-add-subgroup"
              type="primary"
              link
              size="small"
              :icon="Plus"
              @click="addGroup(conditionTree)"
            >
              + 添加嵌套条件组 (Group)
            </el-button>
          </div>
        </div>

        <div class="group-body">
          <div v-if="conditionTree.children.length === 0" class="empty-rules">尚未添加筛选条件</div>
          <div v-for="child in conditionTree.children" :key="child.id">
            <div v-if="child.type === 'rule'" class="rule">
              <el-select v-model="child.field" placeholder="选择指标" style="width: 150px" size="small">
                <el-option v-for="f in fieldOptions" :key="f.value" :label="f.label" :value="f.value" />
              </el-select>
              <el-select v-model="child.operator" placeholder="算子" style="width: 110px" size="small">
                <el-option v-for="op in operatorOptions" :key="op.value" :label="op.label" :value="op.value" />
              </el-select>
              <el-select v-if="child.field === 'channel'" v-model="child.value" style="width: 140px" size="small">
                <el-option label="线上自营" value="线上自营" />
                <el-option label="线下加盟" value="线下加盟" />
                <el-option label="跨境专区" value="跨境专区" />
              </el-select>
              <el-select v-else-if="child.field === 'region'" v-model="child.value" style="width: 140px" size="small">
                <el-option label="华东" value="华东" />
                <el-option label="华南" value="华南" />
                <el-option label="华北" value="华北" />
                <el-option label="西南" value="西南" />
              </el-select>
              <el-input-number v-else v-model="child.value" style="width: 140px" size="small" />
              <el-button type="danger" link size="small" :icon="Delete" @click="removeNode(conditionTree, child.id)" />
            </div>

            <div v-else class="group nested">
              <div class="group-bar">
                <el-radio-group v-model="child.logicalOperator" size="small">
                  <el-radio-button label="AND">AND (且)</el-radio-button>
                  <el-radio-button label="OR">OR (或)</el-radio-button>
                </el-radio-group>
                <div class="group-btns">
                  <el-button size="small" :icon="Plus" @click="addRule(child)">添加条件</el-button>
                  <el-button type="danger" link size="small" :icon="Delete" @click="removeNode(conditionTree, child.id)">
                    删除子组
                  </el-button>
                </div>
              </div>
              <div class="group-body">
                <div v-for="sub in child.children" :key="sub.id" class="rule">
                  <template v-if="sub.type === 'rule'">
                    <el-select v-model="sub.field" placeholder="选择指标" style="width: 150px" size="small">
                      <el-option v-for="f in fieldOptions" :key="f.value" :label="f.label" :value="f.value" />
                    </el-select>
                    <el-select v-model="sub.operator" placeholder="算子" style="width: 110px" size="small">
                      <el-option v-for="op in operatorOptions" :key="op.value" :label="op.label" :value="op.value" />
                    </el-select>
                    <el-input-number v-model="sub.value" style="width: 140px" size="small" />
                    <el-button type="danger" link size="small" :icon="Delete" @click="removeNode(child, sub.id)" />
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="result-panel">
      <div class="result-head">
        <span>按品类汇总 · 退货率降序</span>
        <span v-if="isCalculated">{{ pivotRows.length }} 个品类</span>
        <span v-else class="muted">尚未计算</span>
      </div>
      <el-table :data="pivotRows" size="small" style="width: 100%" height="100%">
        <el-table-column prop="category" label="品类" width="120" />
        <el-table-column prop="matchCount" label="商家数" width="88" align="center" />
        <el-table-column prop="totalGmv" label="GMV" min-width="140" align="right">
          <template #default="{ row }">{{ row.totalGmv.toLocaleString('zh-CN') }}</template>
        </el-table-column>
        <el-table-column prop="avgOrderGmv" label="客单价" width="100" align="right" />
        <el-table-column prop="avgReturnRate" label="退货率" width="90" align="right">
          <template #default="{ row }">
            <span class="danger">{{ row.avgReturnRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="totalComplaints" label="客诉" width="80" align="center" />
        <el-table-column prop="riskLevel" label="风险" width="88" align="center">
          <template #default="{ row }">
            <el-tag
              :type="row.riskLevel === '高' ? 'danger' : row.riskLevel === '中' ? 'warning' : 'success'"
              size="small"
            >
              {{ row.riskLevel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="" min-width="120">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openDrilldown(row)">展开异常明细</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer v-model="drawerOpen" :title="selectedCategory?.category" size="560px" direction="rtl">
      <div v-if="selectedCategory" class="drill">
        <div class="kpis">
          <div><em>退货率</em><b class="danger">{{ selectedCategory.avgReturnRate }}%</b></div>
          <div><em>客单价</em><b>{{ selectedCategory.avgOrderGmv }}</b></div>
          <div><em>客诉</em><b>{{ selectedCategory.totalComplaints }}</b></div>
        </div>
        <el-table :data="selectedCategory.records" size="small">
          <el-table-column prop="merchantName" label="商家" min-width="150" />
          <el-table-column prop="region" label="大区" width="64" />
          <el-table-column prop="returnRate" label="退货率" width="80">
            <template #default="{ row }">
              <span class="danger">{{ row.returnRate }}%</span>
            </template>
          </el-table-column>
          <el-table-column prop="complaints" label="客诉" width="64" align="center" />
          <el-table-column prop="topRiskSku" label="问题 SKU" min-width="180" />
        </el-table>
        <div class="export-row">
          <el-button id="btn-export-records" type="primary" size="small" :icon="Download" @click="exportExcel">
            导出异常明细报表 (.xlsx)
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.olap-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f7f8fa;
}

.bi-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 16px;
  height: 44px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #eceef2;
}

.dataset {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
}

.dataset span {
  font-weight: 400;
  color: #8c8c8c;
  font-size: 12px;
}

.filter-panel {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eceef2;
}

.filter-head {
  display: flex;
  justify-content: flex-start;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 13px;
}

.hint,
.muted {
  color: #8c8c8c;
  font-size: 12px;
}

.group {
  padding: 10px;
  background: #fafbfc;
  border: 1px dashed #d9d9d9;
}

.group.nested {
  margin-top: 8px;
  margin-left: 18px;
  border-left: 2px solid #2f54eb;
  background: #fff;
}

.group-bar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.group-btns {
  display: flex;
  gap: 4px;
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.empty-rules {
  font-size: 12px;
  color: #8c8c8c;
}

.rule {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: #fff;
  border: 1px solid #f0f0f0;
}

.result-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.result-head {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 12px;
  color: #595959;
  border-bottom: 1px solid #f0f0f0;
}

.danger {
  color: #cf1322;
  font-weight: 600;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.kpis div {
  padding: 8px 10px;
  background: #fafafa;
}

.kpis em {
  display: block;
  font-style: normal;
  font-size: 11px;
  color: #8c8c8c;
}

.kpis b {
  font-size: 16px;
}

.export-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
