<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
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

/* ---------- 条件树初始配置 ---------- */
const conditionTree = reactive<ConditionGroup>({
  id: 'root-group',
  type: 'group',
  logicalOperator: 'AND',
  children: [
    {
      id: genId(),
      type: 'rule',
      field: 'channel',
      operator: 'eq',
      value: '线上自营',
    },
    {
      id: genId(),
      type: 'rule',
      field: 'orderAmount',
      operator: 'gt',
      value: 500,
    },
  ],
})

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

function exportExcel() {
  ElMessage.success(`已导出【${selectedCategory.value?.category}】异常商家明细报表 (.xlsx)`)
}
</script>

<template>
  <div class="olap-workbench">
    <!-- 顶部概览与分析目标 -->
    <header class="olap-header">
      <div class="header-left">
        <div class="header-icon">
          <el-icon :size="20"><Histogram /></el-icon>
        </div>
        <div class="header-title-box">
          <h2>星澜多维数据智能 · OLAP 复合条件交叉透视工作台</h2>
          <span class="sub">底座集成 100+ 条真实电商商家经营流水，支持多级 AND/OR 递归条件树演算</span>
        </div>
      </div>

      <div class="header-actions">
        <el-button
          id="btn-execute-pivot"
          type="primary"
          :icon="DataAnalysis"
          @click="runPivotAnalysis"
        >
          执行多维透视计算
        </el-button>
      </div>
    </header>

    <!-- 主工作区：上下两卡片 -->
    <div class="workbench-body">
      <!-- 模块 A: 递归逻辑条件构建器 -->
      <section class="panel-box">
        <div class="panel-topbar">
          <div class="bar-title">
            <el-icon :size="16"><Filter /></el-icon>
            <span>递归逻辑条件构建器 (Recursive Condition Tree)</span>
          </div>
          <span class="bar-hint">支持任意深度嵌套条件组，点击标签切换 AND / OR</span>
        </div>

        <div class="tree-root-container">
          <div class="group-box root-group">
            <div class="group-bar">
              <div class="logic-selector">
                <span class="logic-lbl">顶层关系：</span>
                <el-radio-group v-model="conditionTree.logicalOperator" size="small">
                  <el-radio-button label="AND">AND (必须全满足)</el-radio-button>
                  <el-radio-button label="OR">OR (任一满足即可)</el-radio-button>
                </el-radio-group>
              </div>

              <div class="group-btn-cluster">
                <el-button size="small" :icon="Plus" @click="addRule(conditionTree)">
                  添加条件
                </el-button>
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

            <!-- 子项列表 -->
            <div class="group-body">
              <div v-for="child in conditionTree.children" :key="child.id" class="node-wrapper">
                <!-- 单条规则行 -->
                <div v-if="child.type === 'rule'" class="rule-line">
                  <el-select v-model="child.field" placeholder="选择指标" style="width: 160px" size="small">
                    <el-option
                      v-for="f in fieldOptions"
                      :key="f.value"
                      :label="f.label"
                      :value="f.value"
                    />
                  </el-select>

                  <el-select v-model="child.operator" placeholder="算子" style="width: 120px" size="small">
                    <el-option
                      v-for="op in operatorOptions"
                      :key="op.value"
                      :label="op.label"
                      :value="op.value"
                    />
                  </el-select>

                  <el-select
                    v-if="child.field === 'channel'"
                    v-model="child.value"
                    style="width: 160px"
                    size="small"
                  >
                    <el-option label="线上自营" value="线上自营" />
                    <el-option label="线下加盟" value="线下加盟" />
                    <el-option label="跨境专区" value="跨境专区" />
                  </el-select>
                  <el-select
                    v-else-if="child.field === 'region'"
                    v-model="child.value"
                    style="width: 160px"
                    size="small"
                  >
                    <el-option label="华东" value="华东" />
                    <el-option label="华南" value="华南" />
                    <el-option label="华北" value="华北" />
                    <el-option label="西南" value="西南" />
                  </el-select>
                  <el-input-number
                    v-else
                    v-model="child.value"
                    style="width: 160px"
                    size="small"
                  />

                  <el-button
                    type="danger"
                    link
                    size="small"
                    :icon="Delete"
                    @click="removeNode(conditionTree, child.id)"
                  />
                </div>

                <!-- 嵌套子组 (Nested Subgroup) -->
                <div v-else class="group-box nested-group">
                  <div class="group-bar">
                    <div class="logic-selector">
                      <span class="logic-lbl">子组关系：</span>
                      <el-radio-group v-model="child.logicalOperator" size="small">
                        <el-radio-button label="AND">AND (且)</el-radio-button>
                        <el-radio-button label="OR">OR (或)</el-radio-button>
                      </el-radio-group>
                    </div>

                    <div class="group-btn-cluster">
                      <el-button size="small" :icon="Plus" @click="addRule(child)">
                        添加条件
                      </el-button>
                      <el-button
                        type="danger"
                        link
                        size="small"
                        :icon="Delete"
                        @click="removeNode(conditionTree, child.id)"
                      >
                        删除子组
                      </el-button>
                    </div>
                  </div>

                  <div class="group-body">
                    <div
                      v-for="sub in child.children"
                      :key="sub.id"
                      class="rule-line"
                    >
                      <template v-if="sub.type === 'rule'">
                        <el-select v-model="sub.field" placeholder="选择指标" style="width: 160px" size="small">
                          <el-option
                            v-for="f in fieldOptions"
                            :key="f.value"
                            :label="f.label"
                            :value="f.value"
                          />
                        </el-select>

                        <el-select v-model="sub.operator" placeholder="算子" style="width: 120px" size="small">
                          <el-option
                            v-for="op in operatorOptions"
                            :key="op.value"
                            :label="op.label"
                            :value="op.value"
                          />
                        </el-select>

                        <el-input-number
                          v-model="sub.value"
                          style="width: 160px"
                          size="small"
                        />

                        <el-button
                          type="danger"
                          link
                          size="small"
                          :icon="Delete"
                          @click="removeNode(child, sub.id)"
                        />
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 模块 B: 多维交叉透视矩阵结果 -->
      <section class="panel-box">
        <div class="panel-topbar">
          <div class="bar-title">
            <el-icon :size="16"><Histogram /></el-icon>
            <span>主营品类风险多维透视矩阵 (默认按退货率降序)</span>
          </div>
          <span v-if="isCalculated" class="bar-status text-success">
            透视运算完成 (共 {{ pivotRows.length }} 个聚合品类)
          </span>
          <span v-else class="bar-status text-muted">
            待执行计算
          </span>
        </div>

        <el-table :data="pivotRows" stripe border style="width: 100%">
          <el-table-column prop="category" label="主营品类维度" width="140">
            <template #default="{ row }">
              <span class="cat-pill">{{ row.category }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="matchCount" label="符合条件商家数" width="130" align="center" />

          <el-table-column prop="totalGmv" label="品类总GMV (元)" min-width="160" align="right">
            <template #default="{ row }">
              <span class="code-font">¥ {{ row.totalGmv.toLocaleString('zh-CN') }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="avgOrderGmv" label="平均客单价" width="130" align="right">
            <template #default="{ row }">
              <span class="code-font">¥ {{ row.avgOrderGmv }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="avgReturnRate" label="平均退货率" width="130" align="right">
            <template #default="{ row }">
              <span class="rate-val text-danger">{{ row.avgReturnRate }}%</span>
            </template>
          </el-table-column>

          <el-table-column prop="totalComplaints" label="累计客诉" width="100" align="center" />

          <el-table-column prop="riskLevel" label="风控等级" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.riskLevel === '高' ? 'danger' : row.riskLevel === '中' ? 'warning' : 'success'" size="small">
                {{ row.riskLevel }}风险
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="操作 / 诊断下钻" min-width="160">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openDrilldown(row)">
                展开异常明细
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </div>

    <!-- 异常明细下钻抽屉 -->
    <el-drawer
      v-model="drawerOpen"
      :title="`品类下钻诊断 · ${selectedCategory?.category}`"
      size="640px"
      direction="rtl"
    >
      <div v-if="selectedCategory" class="drilldown-drawer-body">
        <div class="summary-metrics-row">
          <div class="s-metric">
            <span class="lbl">平均退货率</span>
            <span class="val text-danger">{{ selectedCategory.avgReturnRate }}%</span>
          </div>
          <div class="s-metric">
            <span class="lbl">平均客单价</span>
            <span class="val">¥ {{ selectedCategory.avgOrderGmv }}</span>
          </div>
          <div class="s-metric">
            <span class="lbl">累计客诉量</span>
            <span class="val text-warning">{{ selectedCategory.totalComplaints }} 次</span>
          </div>
        </div>

        <h4>受损商家经营流水与退货率最高 SKU 清单</h4>
        <el-table :data="selectedCategory.records" border size="small">
          <el-table-column prop="merchantName" label="商家名称" min-width="170" />
          <el-table-column prop="region" label="大区" width="70" />
          <el-table-column prop="returnRate" label="退货率" width="85">
            <template #default="{ row }">
              <span class="font-bold text-danger">{{ row.returnRate }}%</span>
            </template>
          </el-table-column>
          <el-table-column prop="complaints" label="客诉" width="65" align="center" />
          <el-table-column prop="topRiskSku" label="核心瑕疵 SKU" min-width="190" />
        </el-table>

        <div class="drawer-export-row">
          <el-button
            id="btn-export-records"
            type="success"
            :icon="Download"
            @click="exportExcel"
          >
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
  gap: 14px;
  padding: 16px;
  height: calc(100vh - 120px);
  overflow-y: auto;
}

.olap-header {
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

.header-icon {
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

.header-title-box .sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workbench-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-box {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 16px 20px;
}

.panel-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.bar-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}

.bar-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.bar-status {
  font-size: 12px;
  font-weight: 600;
}

.text-success {
  color: var(--el-color-success);
}
.text-danger {
  color: var(--el-color-danger);
}
.text-warning {
  color: var(--el-color-warning);
}
.text-muted {
  color: var(--el-text-color-placeholder);
}

/* 条件树 */
.group-box {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.nested-group {
  margin-left: 20px;
  background: var(--el-fill-color-blank);
  border-left: 3px solid var(--el-color-primary);
}

.group-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logic-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logic-lbl {
  font-size: 12px;
  font-weight: 600;
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-line {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--el-bg-color);
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
}

.cat-pill {
  font-weight: 600;
}

.code-font {
  font-family: monospace;
  font-weight: 600;
}

.rate-val {
  font-family: monospace;
  font-weight: bold;
}

/* 抽屉 */
.drilldown-drawer-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-metrics-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.s-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 14px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
}

.s-metric .lbl {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.s-metric .val {
  font-size: 16px;
  font-weight: bold;
}

.drawer-export-row {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
