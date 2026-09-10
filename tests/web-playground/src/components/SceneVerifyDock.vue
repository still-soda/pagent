<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  CircleCheck,
  CircleClose,
  RefreshRight,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { activeOracle } from '../oracle'
import type { CheckOutcome } from '../oracle'

const props = defineProps<{
  sceneId: string
}>()

const outcomes = ref<CheckOutcome[] | null>(null)
const hasOracle = computed(() => activeOracle.value != null)

const summary = computed(() => {
  if (!outcomes.value) return null
  const countable = outcomes.value.filter((item) => item.status !== 'unknown')
  return {
    passed: countable.filter((item) => item.status === 'pass').length,
    total: countable.length,
    unknown: outcomes.value.length - countable.length,
  }
})

watch(
  () => props.sceneId,
  () => {
    outcomes.value = null
  },
)

function runVerify() {
  if (!activeOracle.value) return
  outcomes.value = activeOracle.value.verify()
}

function runReset() {
  if (!activeOracle.value) return
  activeOracle.value.reset()
  outcomes.value = null
  ElMessage.success('场景已重置')
}
</script>

<template>
  <div class="verify-dock" role="complementary" aria-label="场景完成判定">
    <div class="dock-header">
      <span class="dock-title">完成判定</span>
      <span v-if="summary" class="verify-summary">
        <template v-if="summary.total">{{ summary.passed }}/{{ summary.total }} 通过</template>
        <template v-else>无页面终态可判定</template>
        <template v-if="summary.unknown"> · {{ summary.unknown }} 项无法判定</template>
      </span>
    </div>

    <div class="verify-actions">
      <button
        type="button"
        class="dock-btn dock-btn-primary"
        :disabled="!hasOracle"
        :title="hasOracle ? '按当前页面终态判定任务是否完成' : '当前场景暂无判定器'"
        @click="runVerify"
      >
        验证完成情况
      </button>
      <button
        type="button"
        class="dock-btn"
        :disabled="!hasOracle"
        title="将场景恢复到初始状态"
        @click="runReset"
      >
        <el-icon :size="12"><RefreshRight /></el-icon>
        重置场景
      </button>
    </div>

    <p v-if="!hasOracle" class="verify-empty">当前场景暂无判定器</p>

    <ul v-else-if="outcomes" class="verify-list">
      <li
        v-for="item in outcomes"
        :key="item.id"
        class="verify-item"
        :data-status="item.status"
      >
        <el-icon class="verify-icon" :size="14">
          <CircleCheck v-if="item.status === 'pass'" />
          <CircleClose v-else-if="item.status === 'fail'" />
          <WarningFilled v-else />
        </el-icon>
        <div class="verify-body">
          <div class="verify-label">{{ item.label }}</div>
          <div v-if="item.expected || item.actual" class="verify-detail">
            <span v-if="item.expected">期望 {{ item.expected }}</span>
            <span v-if="item.actual">实际 {{ item.actual }}</span>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.verify-dock {
  flex: none;
  max-height: 48%;
  overflow-y: auto;
  padding: 12px 14px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  background: var(--el-bg-color);
}

.dock-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.dock-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.verify-summary {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-align: right;
}

.verify-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dock-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.dock-btn:hover:not(:disabled) {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.dock-btn-primary {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.dock-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.verify-empty {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.verify-list {
  margin: 10px 0 0;
  padding: 10px 0 0;
  border-top: 1px dashed var(--el-border-color-lighter);
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.verify-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.verify-icon {
  margin-top: 1px;
  flex: none;
}

.verify-item[data-status='pass'] .verify-icon {
  color: var(--el-color-success);
}

.verify-item[data-status='fail'] .verify-icon {
  color: var(--el-color-danger);
}

.verify-item[data-status='unknown'] .verify-icon {
  color: var(--el-color-warning);
}

.verify-body {
  min-width: 0;
}

.verify-label {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}

.verify-detail {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 2px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
</style>
