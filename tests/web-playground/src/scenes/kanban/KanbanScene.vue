<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Connection,
  Plus,
  Search,
  User,
} from '@element-plus/icons-vue'
import { initialKanbanColumns } from './data'
import type { KanbanCard, KanbanColumn, PriorityType } from './types'

const columns = reactive<KanbanColumn[]>(JSON.parse(JSON.stringify(initialKanbanColumns)))

/* ---------- 过滤器 ---------- */
const filterAssignee = ref('')
const filterPriority = ref('')
const filterEpic = ref('')
const searchQuery = ref('')

function filterCards(cards: KanbanCard[]): KanbanCard[] {
  return cards.filter((card) => {
    if (filterAssignee.value && card.assignee !== filterAssignee.value) return false
    if (filterPriority.value && card.priority !== filterPriority.value) return false
    if (filterEpic.value && card.epic !== filterEpic.value) return false
    if (
      searchQuery.value.trim() &&
      !card.title.includes(searchQuery.value.trim()) &&
      !card.id.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
    ) {
      return false
    }
    return true
  })
}

/* ---------- 拖拽交互 ---------- */
const draggedCard = ref<KanbanCard | null>(null)
const sourceColumnId = ref<string | null>(null)
const dragOverColumnId = ref<string | null>(null)

function onDragStart(event: DragEvent, card: KanbanCard, colId: string) {
  draggedCard.value = card
  sourceColumnId.value = colId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', card.id)
  }
}

function onDragOver(event: DragEvent, colId: string) {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dragOverColumnId.value = colId
}

function onDragLeave(colId: string) {
  if (dragOverColumnId.value === colId) {
    dragOverColumnId.value = null
  }
}

function onDrop(event: DragEvent, targetColId: string) {
  event.preventDefault()
  dragOverColumnId.value = null

  if (!draggedCard.value || !sourceColumnId.value) return

  const srcCol = columns.find((c) => c.id === sourceColumnId.value)
  const targetCol = columns.find((c) => c.id === targetColId)

  if (!srcCol || !targetCol) return

  const indexInSrc = srcCol.cards.findIndex((c) => c.id === draggedCard.value?.id)
  if (indexInSrc !== -1) {
    const [card] = srcCol.cards.splice(indexInSrc, 1)
    targetCol.cards.unshift(card)
    ElMessage.success(`卡片【${card.title}】已移动至【${targetCol.title}】顶部`)
  }

  draggedCard.value = null
  sourceColumnId.value = null
}

function moveCardToAcceptanceTop(card: KanbanCard) {
  for (const col of columns) {
    const idx = col.cards.findIndex((c) => c.id === card.id)
    if (idx !== -1) {
      const [removed] = col.cards.splice(idx, 1)
      const accCol = columns.find((c) => c.id === 'acceptance')
      if (accCol) {
        accCol.cards.unshift(removed)
        ElMessage.success(`卡片【${removed.title}】已置顶移动至【待验收】`)
      }
      return
    }
  }
}

/* ---------- 详情抽屉 ---------- */
const drawerOpen = ref(false)
const activeCard = ref<KanbanCard | null>(null)
const newDepInput = ref('')

function openCardDrawer(card: KanbanCard) {
  activeCard.value = card
  drawerOpen.value = true
}

function addDependency() {
  if (!activeCard.value || !newDepInput.value.trim()) return
  if (!activeCard.value.dependencies.includes(newDepInput.value.trim())) {
    activeCard.value.dependencies.push(newDepInput.value.trim())
    ElMessage.success(`已添加前置依赖: ${newDepInput.value.trim()}`)
    newDepInput.value = ''
  }
}

function removeDependency(dep: string) {
  if (!activeCard.value) return
  activeCard.value.dependencies = activeCard.value.dependencies.filter((d) => d !== dep)
}

function priorityType(p: PriorityType): 'danger' | 'warning' | 'primary' | 'info' {
  if (p.includes('P0')) return 'danger'
  if (p.includes('P1')) return 'warning'
  if (p.includes('P2')) return 'primary'
  return 'info'
}
</script>

<template>
  <div class="kanban-workbench">
    <!-- 顶部控制与多维筛选工具栏 -->
    <header class="kanban-header">
      <div class="header-left">
        <span class="board-title">星澜敏捷协同 · 2026 Q3 核心版本迭代看板</span>
        <span class="total-cards">全盘任务：{{ columns.reduce((acc, c) => acc + c.cards.length, 0) }} 项</span>
      </div>

      <div class="filter-controls">
        <el-select
          v-model="filterAssignee"
          placeholder="全部责任人"
          clearable
          style="width: 130px"
          size="small"
        >
          <el-option label="林工" value="林工" />
          <el-option label="王工" value="王工" />
          <el-option label="陈工" value="陈工" />
          <el-option label="张工" value="张工" />
          <el-option label="李工" value="李工" />
        </el-select>

        <el-select
          v-model="filterPriority"
          placeholder="全部优先级"
          clearable
          style="width: 130px"
          size="small"
        >
          <el-option label="P0-紧急" value="P0-紧急" />
          <el-option label="P1-高" value="P1-高" />
          <el-option label="P2-中" value="P2-中" />
          <el-option label="P3-低" value="P3-低" />
        </el-select>

        <el-select
          v-model="filterEpic"
          placeholder="全部业务史诗"
          clearable
          style="width: 140px"
          size="small"
        >
          <el-option label="核心改造" value="核心改造" />
          <el-option label="用户体验" value="用户体验" />
          <el-option label="基础设施" value="基础设施" />
          <el-option label="国际化出海" value="国际化出海" />
        </el-select>

        <el-input
          v-model="searchQuery"
          placeholder="搜索任务标题或编号..."
          :prefix-icon="Search"
          clearable
          style="width: 210px"
          size="small"
        />
      </div>
    </header>

    <!-- 横向超宽泳道视口 -->
    <main class="board-viewport">
      <div class="board-lane-track">
        <div
          v-for="col in columns"
          :key="col.id"
          class="swimlane-column"
          :class="{ 'swimlane-dragover': dragOverColumnId === col.id }"
          @dragover="onDragOver($event, col.id)"
          @dragleave="onDragLeave(col.id)"
          @drop="onDrop($event, col.id)"
        >
          <div class="lane-header">
            <div class="lane-title-box">
              <span class="lane-name">{{ col.title }}</span>
              <span class="lane-counter">{{ filterCards(col.cards).length }}</span>
            </div>
          </div>

          <div class="cards-stream">
            <div
              v-for="card in filterCards(col.cards)"
              :key="card.id"
              :id="`card-${card.id}`"
              class="task-card"
              :class="{ 'card-ghost': draggedCard?.id === card.id }"
              draggable="true"
              @dragstart="onDragStart($event, card, col.id)"
            >
              <div class="card-meta-top">
                <span class="card-code">{{ card.id }}</span>
                <el-tag :type="priorityType(card.priority)" size="small" effect="plain">
                  {{ card.priority }}
                </el-tag>
              </div>

              <div class="card-title-text" @click="openCardDrawer(card)">
                {{ card.title }}
              </div>

              <div v-if="card.dependencies.length > 0" class="card-dep-badge">
                <el-icon :size="12"><Connection /></el-icon>
                <span>依赖: {{ card.dependencies.join(', ') }}</span>
              </div>

              <div class="card-meta-middle">
                <span class="epic-badge">{{ card.epic }}</span>
                <span class="sp-pill">{{ card.storyPoints }} SP</span>
              </div>

              <div class="subtask-progress-box">
                <span class="subtask-ratio">子任务 {{ card.completedSubtasks }}/{{ card.totalSubtasks }}</span>
                <el-progress
                  :percentage="Math.round((card.completedSubtasks / card.totalSubtasks) * 100)"
                  :stroke-width="4"
                  :show-text="false"
                />
              </div>

              <div class="card-footer-row">
                <div class="tags-cluster">
                  <span v-for="tag in card.tags" :key="tag" class="chip">{{ tag }}</span>
                </div>
                <div class="assignee-box">
                  <el-icon :size="12"><User /></el-icon>
                  <span>{{ card.assignee }}</span>
                </div>
              </div>

              <div class="card-hover-actions">
                <el-button size="small" link type="primary" @click.stop="openCardDrawer(card)">
                  配置详情
                </el-button>
                <el-button
                  v-if="col.id !== 'acceptance'"
                  size="small"
                  link
                  type="success"
                  @click.stop="moveCardToAcceptanceTop(card)"
                >
                  移至待验收
                </el-button>
              </div>
            </div>

            <div v-if="filterCards(col.cards).length === 0" class="empty-lane">
              暂无符合条件的任务卡片
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 卡片详情与前置依赖配置抽屉 -->
    <el-drawer
      v-model="drawerOpen"
      :title="`任务工单详情 · ${activeCard?.id}`"
      size="520px"
      direction="rtl"
    >
      <div v-if="activeCard" class="card-drawer-content">
        <div class="drawer-header-block">
          <h3>{{ activeCard.title }}</h3>
          <p class="drawer-desc">{{ activeCard.description }}</p>
        </div>

        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="任务编号">{{ activeCard.id }}</el-descriptions-item>
          <el-descriptions-item label="所属史诗">{{ activeCard.epic }}</el-descriptions-item>
          <el-descriptions-item label="责任研发">{{ activeCard.assignee }}</el-descriptions-item>
          <el-descriptions-item label="优先级">
            <el-tag :type="priorityType(activeCard.priority)" size="small">
              {{ activeCard.priority }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="故事点估算">{{ activeCard.storyPoints }} SP</el-descriptions-item>
          <el-descriptions-item label="子任务进度">
            {{ activeCard.completedSubtasks }} / {{ activeCard.totalSubtasks }} 完成
          </el-descriptions-item>
        </el-descriptions>

        <!-- 前置依赖链路 -->
        <div class="dep-section">
          <div class="dep-top">
            <h4>前置阻塞依赖 (Blocker Dependencies)</h4>
            <span class="dep-tip">该任务必须等待前置依赖全部在主干部署后方可发起验收</span>
          </div>

          <div class="dep-container">
            <div v-if="activeCard.dependencies.length === 0" class="no-dep-tip">
              当前无前置阻塞依赖
            </div>
            <div
              v-for="dep in activeCard.dependencies"
              :key="dep"
              class="dep-item-box"
            >
              <el-icon :size="14"><Connection /></el-icon>
              <span class="dep-title">{{ dep }}</span>
              <el-button type="danger" link size="small" @click="removeDependency(dep)">
                移除
              </el-button>
            </div>
          </div>

          <div class="dep-add-bar">
            <el-input
              v-model="newDepInput"
              placeholder="输入或选择前置依赖，如：基础支付服务 v2.4.0"
              size="small"
              style="flex: 1"
            />
            <el-button
              id="btn-add-dep"
              type="primary"
              size="small"
              :icon="Plus"
              @click="addDependency"
            >
              添加依赖
            </el-button>
          </div>
        </div>

        <div class="drawer-action-row">
          <el-button type="primary" @click="drawerOpen = false">保存并关闭</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.kanban-workbench {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  padding: 16px;
  gap: 14px;
}

.kanban-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.board-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.total-cards {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 横向泳道滚动视口 */
.board-viewport {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 6px;
}

.board-lane-track {
  display: flex;
  gap: 14px;
  min-width: 1600px;
  height: 100%;
}

.swimlane-column {
  flex: 1;
  width: 300px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  padding: 12px;
  transition: background-color 0.15s, border-color 0.15s;
}

.swimlane-dragover {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.lane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.lane-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lane-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.lane-counter {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 8px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.cards-stream {
  flex: 1;
  overflow-y: auto;
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  cursor: grab;
  transition: transform 0.15s, box-shadow 0.15s;
}

.task-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.card-ghost {
  opacity: 0.4;
  border-style: dashed;
  border-color: var(--el-color-primary);
}

.card-meta-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.card-code {
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.card-title-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  margin-bottom: 6px;
}

.card-dep-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--el-color-warning);
  margin-bottom: 6px;
  padding: 2px 6px;
  background: var(--el-color-warning-light-9);
  border-radius: 4px;
}

.card-meta-middle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.epic-badge {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.sp-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
}

.subtask-progress-box {
  margin-bottom: 8px;
}

.subtask-ratio {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
  display: block;
  margin-bottom: 2px;
}

.card-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.tags-cluster {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.chip {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.assignee-box {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--el-text-color-regular);
}

.card-hover-actions {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--el-border-color-lighter);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.empty-lane {
  text-align: center;
  padding: 30px 0;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

/* 抽屉 */
.card-drawer-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-header-block h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.drawer-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.dep-section {
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-light);
}

.dep-top h4 {
  margin: 0;
  font-size: 14px;
}

.dep-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.dep-container {
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.no-dep-tip {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.dep-item-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.dep-title {
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  margin-left: 8px;
}

.dep-add-bar {
  display: flex;
  gap: 8px;
}

.drawer-action-row {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}
</style>
