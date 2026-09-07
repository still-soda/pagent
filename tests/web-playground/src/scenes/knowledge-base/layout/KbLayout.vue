<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Reading } from '@element-plus/icons-vue'
import { articles, categories } from '../data'

const route = useRoute()
const router = useRouter()

const activeCategory = computed(() => (route.query.category as string) || 'all')

const recent = computed(() =>
  [...articles]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5),
)

function countOf(key: string): number {
  return key === 'all'
    ? articles.length
    : articles.filter((article) => article.category === key).length
}

function goCategory(key: string) {
  router.push(key === 'all' ? '/knowledge-base' : { path: '/knowledge-base', query: { category: key } })
}
</script>

<template>
  <div class="kb-layout">
    <aside class="kb-sidebar">
      <div class="kb-brand">
        <div class="kb-name">
          <el-icon :size="16"><Reading /></el-icon>
          星澜知识库
        </div>
        <p class="kb-desc">团队协作知识的唯一来源</p>
      </div>

      <el-button
        type="primary"
        class="new-doc-btn"
        data-action="new-doc"
        @click="router.push('/knowledge-base/write')"
      >
        + 新建文档
      </el-button>

      <nav class="kb-nav" aria-label="知识库分类">
        <button
          type="button"
          class="nav-item"
          :class="{ active: activeCategory === 'all' }"
          @click="goCategory('all')"
        >
          <span>全部文档</span>
          <span class="nav-count">{{ countOf('all') }}</span>
        </button>
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          class="nav-item"
          :class="{ active: activeCategory === cat.key }"
          @click="goCategory(cat.key)"
        >
          <span>{{ cat.label }}</span>
          <span class="nav-count">{{ countOf(cat.key) }}</span>
        </button>
      </nav>

      <div class="kb-recent">
        <div class="recent-title">最近更新</div>
        <RouterLink
          v-for="item in recent"
          :key="item.slug"
          :to="`/knowledge-base/articles/${item.slug}`"
          target="_blank"
          class="recent-item"
        >
          <span class="recent-name">{{ item.title }}</span>
          <span class="recent-date">{{ item.date }}</span>
        </RouterLink>
      </div>
    </aside>

    <div class="kb-main">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.kb-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.kb-sidebar {
  flex: none;
  position: sticky;
  top: 12px;
  width: 236px;
  padding: 18px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.kb-brand {
  padding: 0 4px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.kb-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.kb-desc {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.new-doc-btn {
  width: 100%;
  margin: 14px 0;
}

.kb-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.nav-item:hover {
  background: var(--el-fill-color);
}

.nav-item.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.nav-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.kb-recent {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.recent-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.recent-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 8px;
  text-decoration: none;
  transition: background-color 0.15s;
}

.recent-item:hover {
  background: var(--el-fill-color);
}

.recent-name {
  font-size: 13px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-date {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.kb-main {
  flex: 1;
  min-width: 0;
}

@media (max-width: 900px) {
  .kb-layout {
    flex-direction: column;
  }

  .kb-sidebar {
    position: static;
    width: 100%;
  }
}
</style>
