<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getArticle, articles, categories } from '../data'
import BlockRenderer from '../components/BlockRenderer.vue'

const route = useRoute()

const article = computed(() => getArticle(route.params.slug as string))
const category = computed(() =>
  categories.find((item) => item.key === article.value?.category),
)

const related = computed(() =>
  article.value?.related
    .map((slug) => getArticle(slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item)) ?? [],
)

const currentIndex = computed(() =>
  articles.findIndex((item) => item.slug === article.value?.slug),
)
const prevArticle = computed(() =>
  currentIndex.value > 0 ? articles[currentIndex.value - 1] : undefined,
)
const nextArticle = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < articles.length - 1
    ? articles[currentIndex.value + 1]
    : undefined,
)

const toc = computed(() =>
  article.value?.blocks
    .filter((block) => block.type === 'heading')
    .map((block) => {
      const text = block.type === 'heading' ? block.text : ''
      return {
        id: text
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\p{L}\p{N}-]/gu, ''),
        text,
      }
    }) ?? [],
)

const bodyRef = ref<HTMLElement | null>(null)

function scrollToHeading(id: string) {
  const target = bodyRef.value?.querySelector(`#${CSS.escape(id)}`)
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(
  () => route.params.slug,
  () => {
    window.scrollTo({ top: 0 })
  },
)
</script>

<template>
  <div v-if="article" class="article-page">
    <article class="article-main">
      <el-breadcrumb separator="/" class="article-breadcrumb">
        <el-breadcrumb-item :to="{ path: '/knowledge-base' }">知识库</el-breadcrumb-item>
        <el-breadcrumb-item :to="{ path: `/knowledge-base?category=${article.category}` }">
          {{ category?.label }}
        </el-breadcrumb-item>
        <el-breadcrumb-item>{{ article.title }}</el-breadcrumb-item>
      </el-breadcrumb>

      <header class="article-header">
        <h1>{{ article.title }}</h1>
        <div class="article-meta">
          <span class="meta-author">{{ article.author }} · {{ article.role }}</span>
          <span>{{ article.date }}</span>
          <span>{{ article.readMins }} 分钟阅读</span>
          <span>{{ article.views }} 次阅读</span>
          <el-tag
            :type="category?.tagType"
            size="small"
            effect="light"
          >
            {{ category?.label }}
          </el-tag>
        </div>
        <div class="article-tags">
          <el-tag v-for="tag in article.tags" :key="tag" size="small" type="info" effect="plain">
            # {{ tag }}
          </el-tag>
        </div>
      </header>

      <div ref="bodyRef" class="article-body">
        <BlockRenderer v-for="(block, index) in article.blocks" :key="index" :block="block" />
      </div>

      <section v-if="related.length" class="article-related">
        <h3>相关文档</h3>
        <div class="related-grid">
          <RouterLink
            v-for="item in related"
            :key="item.slug"
            :to="`/knowledge-base/articles/${item.slug}`"
            target="_blank"
            class="related-card"
          >
            <span class="related-title">{{ item.title }}</span>
            <span class="related-summary">{{ item.summary }}</span>
          </RouterLink>
        </div>
      </section>

      <nav class="article-pager">
        <RouterLink
          v-if="prevArticle"
          :to="`/knowledge-base/articles/${prevArticle.slug}`"
          target="_blank"
          class="pager-link"
        >
          <span class="pager-label">上一篇</span>
          <span class="pager-title">{{ prevArticle.title }}</span>
        </RouterLink>
        <span v-else class="pager-placeholder" />
        <RouterLink
          v-if="nextArticle"
          :to="`/knowledge-base/articles/${nextArticle.slug}`"
          target="_blank"
          class="pager-link right"
        >
          <span class="pager-label">下一篇</span>
          <span class="pager-title">{{ nextArticle.title }}</span>
        </RouterLink>
      </nav>
    </article>

    <aside class="article-toc">
      <div class="toc-title">目录</div>
      <button
        v-for="item in toc"
        :key="item.id"
        type="button"
        class="toc-item"
        @click="scrollToHeading(item.id)"
      >
        {{ item.text }}
      </button>
    </aside>
  </div>

  <el-card v-else shadow="never" class="article-missing">
    <el-empty description="未找到该文档，可能已被移动或删除">
      <el-button type="primary" @click="$router.push('/knowledge-base')">返回知识库</el-button>
    </el-empty>
  </el-card>
</template>

<style scoped>
.article-page {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.article-main {
  flex: 1;
  min-width: 0;
  padding: 22px 26px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.article-breadcrumb {
  margin-bottom: 14px;
}

.article-header h1 {
  margin: 0 0 10px;
  font-size: 24px;
  line-height: 1.4;
  color: var(--el-text-color-primary);
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.meta-author {
  color: var(--el-text-color-regular);
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.article-body {
  margin-top: 18px;
}

.article-related {
  margin-top: 26px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.article-related h3 {
  margin: 0 0 10px;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.related-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  text-decoration: none;
  transition: border-color 0.15s, background-color 0.15s;
}

.related-card:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-fill-color-lighter);
}

.related-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.related-summary {
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.article-pager {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
}

.pager-link {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 46%;
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  text-decoration: none;
  transition: border-color 0.15s;
}

.pager-link:hover {
  border-color: var(--el-color-primary-light-5);
}

.pager-link.right {
  text-align: right;
  margin-left: auto;
}

.pager-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.pager-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.pager-placeholder {
  flex: 1;
}

.article-toc {
  flex: none;
  position: sticky;
  top: 12px;
  width: 210px;
  padding: 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.toc-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.toc-item {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.toc-item:hover {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}

.article-missing {
  border-radius: 12px;
}

@media (max-width: 900px) {
  .article-toc {
    display: none;
  }
}
</style>
