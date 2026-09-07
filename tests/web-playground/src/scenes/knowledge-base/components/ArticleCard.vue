<script setup lang="ts">
import { computed } from 'vue'
import type { Article } from '../types'
import { categories } from '../data'

const props = defineProps<{ article: Article }>()

const category = computed(() =>
  categories.find((item) => item.key === props.article.category),
)
</script>

<template>
  <el-card shadow="hover" class="article-card" :body-style="{ padding: '18px 20px' }">
    <div class="card-top">
      <el-tag :type="category?.tagType" size="small" effect="light">
        {{ category?.label }}
      </el-tag>
      <span class="card-date">{{ article.date }}</span>
    </div>
    <h3 class="card-title">
      <RouterLink :to="`/knowledge-base/articles/${article.slug}`" target="_blank" class="card-link">
        {{ article.title }}
      </RouterLink>
    </h3>
    <p class="card-summary">{{ article.summary }}</p>
    <div class="card-meta">
      <span>{{ article.author }} · {{ article.role }}</span>
      <span>{{ article.readMins }} 分钟阅读</span>
      <span>{{ article.views }} 次阅读</span>
    </div>
    <div class="card-tags">
      <el-tag
        v-for="tag in article.tags"
        :key="tag"
        size="small"
        type="info"
        effect="plain"
      >
        # {{ tag }}
      </el-tag>
    </div>
  </el-card>
</template>

<style scoped>
.article-card {
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.article-card:hover {
  transform: translateY(-2px);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.card-date {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.card-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
}

.card-link {
  color: var(--el-text-color-primary);
  text-decoration: none;
}

.card-link:hover {
  color: var(--el-color-primary);
}

.card-summary {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
</style>
