<script setup lang="ts">
import { ref } from 'vue'
import { ChatDotRound, CopyDocument, List } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  steps: string[]
  prompt?: string
}>()

const emit = defineEmits<{ close: [] }>()
const stepsExpanded = ref(true)

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

async function doCopy(text: string, successTip: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else if (!legacyCopy(text)) {
      ElMessage.error('复制失败，请手动选取文本')
      return
    }
    ElMessage.success(successTip)
  } catch {
    if (legacyCopy(text)) {
      ElMessage.success(successTip)
    } else {
      ElMessage.error('复制失败，请手动选取文本')
    }
  }
}

function copyPrompt() {
  if (!props.prompt) return
  doCopy(props.prompt, '用户自然指令已复制到剪贴板，可直接发给 Agent')
}

function copySteps() {
  const text = props.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')
  doCopy(text, '详细验收步骤已复制到剪贴板')
}
</script>

<template>
  <div class="task-panel" role="complementary" aria-label="演练任务指引">
    <!-- 面板主顶栏 -->
    <div class="panel-header">
      <span class="panel-title">
        <el-icon :size="14"><ChatDotRound /></el-icon>
        演练任务指引
      </span>
      <button
        type="button"
        class="task-close"
        aria-label="关闭任务面板"
        title="关闭面板"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <div class="panel-body">
      <!-- 区域 1: 真实用户自然语言模糊指令 (带专属一键复制) -->
      <div v-if="prompt" class="prompt-section">
        <div class="section-bar">
          <span class="section-tag">
            <el-icon :size="12"><ChatDotRound /></el-icon>
            用户自然指令 (日常口吻)
          </span>
          <button
            type="button"
            class="action-copy-btn btn-highlight"
            aria-label="复制用户自然指令"
            title="一键复制真实指令"
            @click="copyPrompt"
          >
            <el-icon :size="12"><CopyDocument /></el-icon>
            复制指令
          </button>
        </div>

        <div class="prompt-bubble">
          <p class="prompt-text">“{{ prompt }}”</p>
        </div>
      </div>

      <!-- 区域 2: 详细验收参考步骤 (可折叠 / 单独复制) -->
      <div class="steps-section">
        <div class="section-bar">
          <button
            type="button"
            class="toggle-steps-btn"
            @click="stepsExpanded = !stepsExpanded"
          >
            <el-icon :size="12"><List /></el-icon>
            <span>验收参考步骤 ({{ steps.length }})</span>
            <span class="arrow-indicator">{{ stepsExpanded ? '▲' : '▼' }}</span>
          </button>

          <button
            type="button"
            class="action-copy-btn"
            aria-label="复制详细验收步骤"
            title="复制分步参考点"
            @click="copySteps"
          >
            <el-icon :size="12"><CopyDocument /></el-icon>
            复制步骤
          </button>
        </div>

        <ol v-if="stepsExpanded" class="task-steps">
          <li v-for="(step, index) in steps" :key="index" class="task-step">
            {{ step }}
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-panel {
  position: fixed;
  top: 76px;
  right: 20px;
  z-index: 1500;
  width: 330px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.panel-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
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
  cursor: pointer;
  transition: all 0.15s;
}

.task-close:hover {
  background: var(--el-fill-color);
  color: var(--el-text-color-primary);
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.section-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.toggle-steps-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  padding: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  cursor: pointer;
}

.arrow-indicator {
  font-size: 9px;
  color: var(--el-text-color-secondary);
}

.action-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-regular);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-copy-btn:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.btn-highlight {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.prompt-bubble {
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 8px;
  padding: 10px 12px;
}

.prompt-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  font-style: italic;
}

.steps-section {
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.task-steps {
  margin: 6px 0 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-step {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}
</style>
