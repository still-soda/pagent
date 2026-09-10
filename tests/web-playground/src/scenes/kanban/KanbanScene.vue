<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSceneOracle } from '../../oracle'
import { verifyKanban } from './verify'
import {
  Connection,
  Plus,
  Search,
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

const assigneeTone: Record<string, string> = {
  林工: '#2563eb',
  王工: '#059669',
  陈工: '#d97706',
  张工: '#7c3aed',
  李工: '#db2777',
}

function laneTone(id: KanbanColumn['id']) {
  if (id === 'in_progress') return 'blue'
  if (id === 'testing') return 'violet'
  if (id === 'acceptance') return 'amber'
  if (id === 'released') return 'green'
  return 'slate'
}

function resetKanban() {
  columns.splice(0, columns.length, ...JSON.parse(JSON.stringify(initialKanbanColumns)))
  filterAssignee.value = ''
  filterPriority.value = ''
  filterEpic.value = ''
  searchQuery.value = ''
  drawerOpen.value = false
  activeCard.value = null
  newDepInput.value = ''
}

useSceneOracle('kanban', {
  verify: () =>
    verifyKanban({
      columns,
      filterAssignee: filterAssignee.value,
    }),
  reset: resetKanban,
})
</script>

<template>
  <div class="kanban-workbench">
    <header class="board-bar">
      <div class="board-id">
        <span class="board-name">支付结算</span>
        <span class="sprint">Sprint 24</span>
        <span class="count">{{ columns.reduce((acc, c) => acc + c.cards.length, 0) }} 项</span>
      </div>
      <div class="filter-controls">
        <el-select v-model="filterAssignee" placeholder="全部责任人" clearable style="width: 120px" size="small">
          <el-option label="林工" value="林工" />
          <el-option label="王工" value="王工" />
          <el-option label="陈工" value="陈工" />
          <el-option label="张工" value="张工" />
          <el-option label="李工" value="李工" />
        </el-select>
        <el-select v-model="filterPriority" placeholder="全部优先级" clearable style="width: 120px" size="small">
          <el-option label="P0-紧急" value="P0-紧急" />
          <el-option label="P1-高" value="P1-高" />
          <el-option label="P2-中" value="P2-中" />
          <el-option label="P3-低" value="P3-低" />
        </el-select>
        <el-select v-model="filterEpic" placeholder="全部业务史诗" clearable style="width: 130px" size="small">
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
          style="width: 200px"
          size="small"
        />
      </div>
    </header>

    <main class="board-viewport">
      <div class="board-lane-track">
        <div
          v-for="col in columns"
          :key="col.id"
          class="swimlane-column"
          :class="[laneTone(col.id), { 'is-over': dragOverColumnId === col.id }]"
          @dragover="onDragOver($event, col.id)"
          @dragleave="onDragLeave(col.id)"
          @drop="onDrop($event, col.id)"
        >
          <div class="lane-header">
            <span class="lane-dot" />
            <span class="lane-name">{{ col.title }}</span>
            <span class="lane-counter">{{ filterCards(col.cards).length }}</span>
          </div>

          <div class="cards-stream">
            <div
              v-for="card in filterCards(col.cards)"
              :key="card.id"
              :id="`card-${card.id}`"
              class="task-card"
              :class="[{ ghost: draggedCard?.id === card.id }, card.priority.slice(0, 2).toLowerCase()]"
              draggable="true"
              @dragstart="onDragStart($event, card, col.id)"
            >
              <div class="card-top">
                <span class="card-code">{{ card.id }}</span>
                <span class="prio">{{ card.priority }}</span>
              </div>
              <button type="button" class="card-title-text" @click="openCardDrawer(card)">
                {{ card.title }}
              </button>
              <div v-if="card.dependencies.length" class="dep">
                <el-icon :size="12"><Connection /></el-icon>
                {{ card.dependencies.join(', ') }}
              </div>
              <div class="card-mid">
                <span class="epic">{{ card.epic }}</span>
                <span class="sp">{{ card.storyPoints }}</span>
              </div>
              <div class="subtasks">
                <span>{{ card.completedSubtasks }}/{{ card.totalSubtasks }}</span>
                <i><b :style="{ width: Math.round((card.completedSubtasks / card.totalSubtasks) * 100) + '%' }" /></i>
              </div>
              <div class="card-foot">
                <div class="tags">
                  <span v-for="tag in card.tags" :key="tag">{{ tag }}</span>
                </div>
                <span class="avatar" :style="{ background: assigneeTone[card.assignee] || '#64748b' }">
                  {{ card.assignee.slice(0, 1) }}
                </span>
              </div>
              <div class="card-actions">
                <el-button size="small" link type="primary" @click.stop="openCardDrawer(card)">配置详情</el-button>
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
            <div v-if="filterCards(col.cards).length === 0" class="empty-lane">没有匹配的卡片</div>
          </div>
        </div>
      </div>
    </main>

    <!-- 卡片详情与前置依赖配置抽屉 -->
    <el-drawer v-model="drawerOpen" :title="activeCard?.id" size="480px" direction="rtl">
      <div v-if="activeCard" class="drawer-body">
        <h3>{{ activeCard.title }}</h3>
        <p class="drawer-desc">{{ activeCard.description }}</p>

        <dl class="meta-grid">
          <div><dt>经办人</dt><dd>{{ activeCard.assignee }}</dd></div>
          <div><dt>史诗</dt><dd>{{ activeCard.epic }}</dd></div>
          <div>
            <dt>优先级</dt>
            <dd><el-tag :type="priorityType(activeCard.priority)" size="small">{{ activeCard.priority }}</el-tag></dd>
          </div>
          <div><dt>故事点</dt><dd>{{ activeCard.storyPoints }}</dd></div>
          <div>
            <dt>子任务</dt>
            <dd>{{ activeCard.completedSubtasks }}/{{ activeCard.totalSubtasks }}</dd>
          </div>
        </dl>

        <div class="dep-section">
          <h4>阻塞依赖</h4>
          <p class="dep-tip">验收前需这些项先合入主干</p>
          <div v-if="activeCard.dependencies.length === 0" class="no-dep">暂无依赖</div>
          <div v-for="dep in activeCard.dependencies" :key="dep" class="dep-row">
            <el-icon :size="14"><Connection /></el-icon>
            <span>{{ dep }}</span>
            <el-button type="danger" link size="small" @click="removeDependency(dep)">移除</el-button>
          </div>
          <div class="dep-add">
            <el-input
              v-model="newDepInput"
              placeholder="输入或选择前置依赖，如：基础支付服务 v2.4.0"
              size="small"
            />
            <el-button id="btn-add-dep" type="primary" size="small" :icon="Plus" @click="addDependency">
              添加依赖
            </el-button>
          </div>
        </div>
        <div class="drawer-foot">
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
  height: 100%;
  background: #ebecf0;
}

.board-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 12px 16px;
  min-height: 48px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #dfe1e6;
}

.board-id {
  display: flex;
  align-items: center;
  gap: 8px;
}

.board-name {
  font-size: 14px;
  font-weight: 600;
}

.sprint,
.count {
  font-size: 12px;
  color: #6b778c;
  padding: 1px 7px;
  background: #f4f5f7;
  border-radius: 3px;
}

.filter-controls {
  display: flex;
  gap: 8px;
}

.board-viewport {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
}

.board-lane-track {
  display: flex;
  gap: 8px;
  min-width: 1480px;
  height: 100%;
  padding: 12px;
}

.swimlane-column {
  flex: 1;
  min-width: 270px;
  display: flex;
  flex-direction: column;
  background: #f4f5f7;
  border-radius: 3px;
}

.swimlane-column.is-over {
  background: #e9f2ff;
}

.lane-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 8px;
}

.lane-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #97a0af;
}

.swimlane-column.blue .lane-dot { background: #0052cc; }
.swimlane-column.violet .lane-dot { background: #6554c0; }
.swimlane-column.amber .lane-dot { background: #ff8b00; }
.swimlane-column.green .lane-dot { background: #00875a; }

.lane-name {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #5e6c84;
}

.lane-counter {
  margin-left: auto;
  font-size: 11px;
  color: #6b778c;
}

.cards-stream {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-card {
  position: relative;
  padding: 8px 10px 8px 12px;
  background: #fff;
  border-radius: 3px;
  box-shadow: 0 1px 1px rgba(9, 30, 66, 0.13);
  cursor: grab;
  border-left: 3px solid #dfe1e6;
}

.task-card.p0 { border-left-color: #de350b; }
.task-card.p1 { border-left-color: #ff8b00; }
.task-card.p2 { border-left-color: #0052cc; }
.task-card.p3 { border-left-color: #97a0af; }
.task-card.ghost { opacity: 0.45; }

.card-top {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6b778c;
}

.card-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.prio {
  font-weight: 600;
}

.card-title-text {
  display: block;
  width: 100%;
  margin: 6px 0 4px;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: #172b4d;
  cursor: pointer;
}

.dep {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
  font-size: 11px;
  color: #974f00;
}

.card-mid {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #6b778c;
  margin-bottom: 6px;
}

.sp {
  font-weight: 700;
}

.subtasks {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 10px;
  color: #6b778c;
}

.subtasks i {
  flex: 1;
  height: 3px;
  background: #dfe1e6;
}

.subtasks b {
  display: block;
  height: 100%;
  background: #0052cc;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tags span {
  font-size: 10px;
  padding: 0 5px;
  background: #f4f5f7;
  color: #5e6c84;
  border-radius: 2px;
}

.avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
  padding-top: 4px;
  border-top: 1px solid #f4f5f7;
}

.empty-lane {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: #97a0af;
}

.drawer-body h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.drawer-desc {
  margin: 0 0 16px;
  color: #5e6c84;
  font-size: 13px;
  line-height: 1.55;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  margin: 0 0 20px;
}

.meta-grid dt {
  font-size: 11px;
  color: #6b778c;
  margin-bottom: 2px;
}

.meta-grid dd {
  margin: 0;
  font-size: 13px;
}

.dep-section h4 {
  margin: 0 0 4px;
  font-size: 13px;
}

.dep-tip,
.no-dep {
  font-size: 12px;
  color: #6b778c;
}

.dep-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  background: #f4f5f7;
}

.dep-row span {
  flex: 1;
  font-size: 13px;
}

.dep-add {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.drawer-foot {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}
</style>
