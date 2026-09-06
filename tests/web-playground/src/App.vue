<script setup lang="ts">
import { computed, ref } from 'vue'
import { Expand } from '@element-plus/icons-vue'
import SceneTaskPanel from './components/SceneTaskPanel.vue'
import { scenes } from './scenes'

const menuOpen = ref(false)
const activeId = ref(scenes[0].id)
const current = computed(
  () => scenes.find((scene) => scene.id === activeId.value) ?? scenes[0],
)

const closedTasks = ref<Record<string, boolean>>({})
const taskVisible = computed(
  () => current.value.task.length > 0 && !closedTasks.value[current.value.id],
)

function onSelect(id: string) {
  activeId.value = id
  menuOpen.value = false
}

function closeTask() {
  closedTasks.value[current.value.id] = true
}
</script>

<template>
  <el-container class="app-shell">
    <el-header class="header" height="auto">
      <button type="button" class="menu-trigger" aria-label="打开菜单" @click="menuOpen = true">
        <el-icon :size="18"><Expand /></el-icon>
      </button>
      <div class="heading">
        <h1>{{ current.title }}</h1>
        <p>{{ current.description }}</p>
      </div>
    </el-header>
    <el-main class="main">
      <component :is="current.component" />
    </el-main>
  </el-container>

  <SceneTaskPanel v-if="taskVisible" :steps="current.task" @close="closeTask" />

  <el-drawer
    v-model="menuOpen"
    direction="ltr"
    size="232px"
    :with-header="false"
    class="nav-drawer"
  >
    <div class="brand">
      <div class="brand-title">星澜工作台</div>
      <div class="brand-sub">v2.4.1</div>
    </div>
    <el-menu :default-active="activeId" class="scene-menu" @select="onSelect">
      <el-menu-item v-for="scene in scenes" :key="scene.id" :index="scene.id">
        <el-icon>
          <component :is="scene.icon" />
        </el-icon>
        <span>{{ scene.title }}</span>
      </el-menu-item>
    </el-menu>
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
}
</style>
