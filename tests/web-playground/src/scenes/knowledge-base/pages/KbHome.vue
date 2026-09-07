<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Collection, EditPen, Search } from '@element-plus/icons-vue'
import { articles, categories } from '../data'
import ArticleCard from '../components/ArticleCard.vue'

const route = useRoute()

const keyword = computed(() => (route.query.q as string) || '')

const activeCategory = computed(() => (route.query.category as string) || 'all')

const categoryLabel = computed(
  () => categories.find((item) => item.key === activeCategory.value)?.label,
)

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return articles.filter((article) => {
    if (activeCategory.value !== 'all' && article.category !== activeCategory.value) {
      return false
    }
    if (!kw) return true
    return (
      article.title.toLowerCase().includes(kw) ||
      article.summary.toLowerCase().includes(kw) ||
      article.tags.some((tag) => tag.toLowerCase().includes(kw))
    )
  })
})
</script>

<template>
  <div class="kb-home">
    <section class="home-hero">
      <div class="hero-text">
        <h2>星澜知识库</h2>
        <p>
          收录产品、技术、数据与流程文档共 {{ articles.length }} 篇，覆盖
          {{ categories.length }} 个分类，是团队协作知识的唯一来源。
        </p>
      </div>
      <el-input
        :model-value="keyword"
        class="hero-search"
        :prefix-icon="Search"
        placeholder="搜索标题、摘要或标签"
        clearable
        aria-label="搜索文档"
        @update:model-value="
          (value: string) => $router.push({ query: { ...$route.query, q: value || undefined } })
        "
      />
    </section>

    <section class="write-entry">
      <div class="entry-text">
        <div class="entry-title">
          <el-icon :size="16"><EditPen /></el-icon>
          汇总写作
        </div>
        <p>跨文档收集资料，在写作中心用富文本编辑器撰写汇总简报并保存。</p>
      </div>
      <el-button type="primary" data-action="open-write" @click="$router.push('/knowledge-base/write')">
        进入写作中心
      </el-button>
    </section>

    <section class="home-list">
      <div class="list-header">
        <h3>
          <el-icon :size="16"><Collection /></el-icon>
          {{ categoryLabel ?? '全部文档' }}
        </h3>
        <span class="list-count">共 {{ filtered.length }} 篇</span>
      </div>

      <el-empty v-if="filtered.length === 0" description="没有找到相关文档" />

      <div v-else class="card-grid">
        <ArticleCard v-for="article in filtered" :key="article.slug" :article="article" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.kb-home {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.home-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 24px;
  border-radius: 14px;
  background: linear-gradient(120deg, var(--el-color-primary-light-9), var(--el-bg-color));
  border: 1px solid var(--el-border-color-lighter);
}

.hero-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
  color: var(--el-text-color-primary);
}

.hero-text p {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.hero-search {
  flex: none;
  width: 280px;
}

.write-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border: 1px dashed var(--el-color-primary-light-5);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.entry-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.entry-text p {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.home-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.list-header h3 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.list-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}
</style>
