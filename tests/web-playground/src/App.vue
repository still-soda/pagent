<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Expand } from '@element-plus/icons-vue'
import SceneTaskPanel from './components/SceneTaskPanel.vue'
import SceneVerifyDock from './components/SceneVerifyDock.vue'
import { scenes } from './scenes'

const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const current = computed(
  () =>
    scenes.find((scene) => scene.id === route.meta.sceneId) ?? scenes[0],
)

const flushScenes = new Set([
  'devops',
  'kanban',
  'reconcile',
  'audit-safety',
  'bi-builder',
])
const isStatement = computed(() => route.name === 'reconcile-statement')
const isFlush = computed(
  () => isStatement.value || flushScenes.has(String(current.value.id)),
)

const closedTasks = ref<Record<string, boolean>>({})
const taskVisible = computed(
  () =>
    !isStatement.value &&
    current.value.task.length > 0 &&
    !closedTasks.value[current.value.id],
)

function onSelect(id: string) {
  router.push({ name: id })
  menuOpen.value = false
}

function closeTask() {
  closedTasks.value[current.value.id] = true
}
</script>

<template>
  <el-container class="app-shell">
    <el-header v-if="!isStatement" class="header" height="auto">
      <button type="button" class="menu-trigger" aria-label="打开菜单" @click="menuOpen = true">
        <el-icon :size="18"><Expand /></el-icon>
      </button>
      <div class="heading">
        <h1>{{ current.title }}</h1>
        <p>{{ current.description }}</p>
      </div>
    </el-header>
    <el-main class="main" :class="{ 'is-flush': isFlush }">
      <router-view />
    </el-main>
  </el-container>

  <SceneTaskPanel
    v-if="taskVisible"
    :steps="current.task"
    :prompt="current.prompt"
    @close="closeTask"
  />

  <el-drawer
    v-model="menuOpen"
    direction="ltr"
    size="280px"
    :with-header="false"
    class="nav-drawer"
  >
    <div class="brand">
      <div class="brand-title">星澜工作台</div>
      <div class="brand-sub">v2.4.1</div>
    </div>
    <el-menu :default-active="current.id" class="scene-menu" @select="onSelect">
      <el-menu-item v-for="scene in scenes" :key="scene.id" :index="scene.id">
        <el-icon>
          <component :is="scene.icon" />
        </el-icon>
        <span>{{ scene.title }}</span>
      </el-menu-item>
    </el-menu>
    <SceneVerifyDock :scene-id="current.id" />
  </el-drawer>
</template>

<style scoped>
.app-shell {
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.menu-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 38px;
  height: 38px;
  border: 1px solid var(--el-border-color);
  border-radius: 10px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  cursor: pointer;
  transition: border-color 0.2s;
}

.menu-trigger:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.heading h1 {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.heading p {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.main {
  background: var(--el-fill-color-light);
}

.main.is-flush {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.main.is-flush > * {
  flex: 1;
  min-height: 0;
}
</style>

<style>
.nav-drawer .el-drawer__body {
  padding: 0;
  display: flex;
  flex-direction: column;
}

.nav-drawer .brand {
  padding: 22px 20px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.nav-drawer .brand-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.nav-drawer .brand-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.nav-drawer .scene-menu {
  border-right: none;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
