<script setup lang="ts">
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  steps: string[]
}>()

const emit = defineEmits<{ close: [] }>()

function buildTaskText(): string {
  return props.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
}

function legacyCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  return ok
}

async function copyTask() {
  const text = buildTaskText()
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else if (!legacyCopy(text)) {
      ElMessage.error('复制失败，请手动选择文本')
      return
    }
    ElMessage.success('任务已复制到剪贴板')
  } catch {
    if (legacyCopy(text)) {
      ElMessage.success('任务已复制到剪贴板')
    } else {
      ElMessage.error('复制失败，请手动选择文本')
    }
  }
}
</script>

<template>
  <div class="task-panel" role="complementary" aria-label="当前任务">
    <div class="task-header">
      <span class="task-title">
        <el-icon :size="14"><Tickets /></el-icon>
        当前任务
      </span>
      <div class="task-actions">
        <button
          type="button"
          class="task-action"
          aria-label="复制任务内容"
          title="复制任务内容"
          @click="copyTask"
        >
          <el-icon :size="14"><CopyDocument /></el-icon>
          复制
        </button>
        <button type="button" class="task-close" aria-label="关闭任务面板" @click="emit('close')">
          ×
        </button>
      </div>
    </div>
    <ol class="task-steps">
      <li v-for="(step, index) in steps" :key="index" class="task-step">{{ step }}</li>
    </ol>
  </div>
</template>

<style scoped>
.task-panel {
  position: fixed;
  top: 86px;
  right: 24px;
  z-index: 1500;
  width: 320px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.task-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.task-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.task-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.task-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.task-action:hover {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}

.task-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.task-close:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.task-steps {
  margin: 8px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-step {
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}
</style>
