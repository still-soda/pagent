<script setup lang="ts">
import { computed, ref } from 'vue'
import { Monitor } from '@element-plus/icons-vue'
import { scenes } from './scenes'

const activeId = ref(scenes[0].id)
const current = computed(
  () => scenes.find((scene) => scene.id === activeId.value) ?? scenes[0],
)

function onSelect(id: string) {
  activeId.value = id
}
</script>

<template>
  <el-container class="app-shell">
    <el-aside width="232px" class="sidebar">
      <div class="brand">
        <el-icon :size="22" color="var(--el-color-primary)">
          <Monitor />
        </el-icon>
        <div>
          <div class="brand-title">Pagent 演练场</div>
          <div class="brand-sub">Web Playground</div>
        </div>
      </div>
      <el-menu
        :default-active="activeId"
        class="scene-menu"
        @select="onSelect"
      >
        <el-menu-item v-for="scene in scenes" :key="scene.id" :index="scene.id">
          <el-icon>
            <component :is="scene.icon" />
          </el-icon>
          <span>{{ scene.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header" height="auto">
        <h1>{{ current.title }}</h1>
        <p>{{ current.description }}</p>
      </el-header>
      <el-main class="main">
        <component :is="current.component" />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-shell {
  height: 100%;
}

.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 12px;
}

.brand-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.brand-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.scene-menu {
  border-right: none;
  flex: 1;
}

.header {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}

.header p {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.main {
  background: var(--el-fill-color-light);
}
</style>
