<script setup lang="ts">
import { computed } from 'vue'
import type { ArticleBlock } from '../types'

const props = defineProps<{ block: ArticleBlock }>()

const INLINE_LINK_RE = /\[\[([a-z0-9-]+)\|([^\]]+)\]\]/g

function headingId(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
}

interface InlineSegment {
  kind: 'text' | 'link'
  value: string
  slug?: string
}

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let lastIndex = 0
  for (const match of text.matchAll(INLINE_LINK_RE)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, index) })
    }
    segments.push({ kind: 'link', value: match[2], slug: match[1] })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) })
  }
  return segments
}

const segments = computed<InlineSegment[] | null>(() => {
  if (props.block.type !== 'paragraph') return null
  return parseInline(props.block.text)
})
</script>

<template>
  <h2 v-if="block.type === 'heading' && block.level === 2" :id="headingId(block.text)" class="article-h2">
    {{ block.text }}
  </h2>
  <h3 v-else-if="block.type === 'heading' && block.level === 3" :id="headingId(block.text)" class="article-h3">
    {{ block.text }}
  </h3>
  <h1 v-else-if="block.type === 'heading'" :id="headingId(block.text)" class="article-h1">
    {{ block.text }}
  </h1>

  <p v-else-if="block.type === 'paragraph'" class="article-paragraph">
    <template v-for="(segment, index) in segments ?? []" :key="index">
      <RouterLink
        v-if="segment.kind === 'link'"
        :to="`/knowledge-base/articles/${segment.slug}`"
        target="_blank"
        class="inner-link"
      >
        {{ segment.value }}
      </RouterLink>
      <template v-else>{{ segment.value }}</template>
    </template>
  </p>

  <ol v-else-if="block.type === 'list' && block.ordered" class="article-list">
    <li v-for="(item, index) in block.items" :key="index">{{ item }}</li>
  </ol>
  <ul v-else-if="block.type === 'list'" class="article-list">
    <li v-for="(item, index) in block.items" :key="index">{{ item }}</li>
  </ul>

  <figure v-else-if="block.type === 'table'" class="article-table-wrap">
    <table class="article-table">
      <thead>
        <tr>
          <th v-for="(header, index) in block.headers" :key="index">{{ header }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
          <td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td>
        </tr>
      </tbody>
    </table>
    <figcaption v-if="block.caption" class="table-caption">{{ block.caption }}</figcaption>
  </figure>

  <figure v-else-if="block.type === 'code'" class="article-code-wrap">
    <pre class="article-code"><code>{{ block.code }}</code></pre>
    <figcaption v-if="block.caption" class="code-caption">{{ block.caption }}</figcaption>
  </figure>

  <blockquote v-else-if="block.type === 'quote'" class="article-quote">
    <p>{{ block.text }}</p>
    <footer v-if="block.cite">—— {{ block.cite }}</footer>
  </blockquote>

  <el-alert
    v-else-if="block.type === 'callout'"
    :title="block.title"
    :type="block.kind"
    :description="block.text"
    show-icon
    :closable="false"
    class="article-callout"
  />

  <figure v-else-if="block.type === 'image'" class="article-image">
    <img :src="block.src" :alt="block.caption ?? ''" loading="lazy" />
    <figcaption v-if="block.caption">{{ block.caption }}</figcaption>
  </figure>

  <hr v-else-if="block.type === 'divider'" class="article-divider" />
</template>

<style scoped>
.article-h1,
.article-h2,
.article-h3 {
  margin: 28px 0 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  scroll-margin-top: 90px;
}

.article-h1 {
  font-size: 22px;
}

.article-h2 {
  font-size: 19px;
}

.article-h3 {
  font-size: 16px;
}

.article-paragraph {
  margin: 0 0 14px;
  font-size: 14px;
  line-height: 1.9;
  color: var(--el-text-color-regular);
}

.inner-link {
  color: var(--el-color-primary);
  text-decoration: none;
  border-bottom: 1px dashed var(--el-color-primary-light-5);
}

.inner-link:hover {
  border-bottom-style: solid;
}

.article-list {
  margin: 0 0 14px;
  padding-left: 22px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.article-table-wrap {
  margin: 0 0 18px;
  overflow-x: auto;
}

.article-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.article-table th,
.article-table td {
  padding: 9px 12px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: left;
  line-height: 1.6;
}

.article-table th {
  background: var(--el-fill-color-light);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.article-table td {
  color: var(--el-text-color-regular);
}

.table-caption,
.code-caption {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.article-code-wrap {
  margin: 0 0 18px;
}

.article-code {
  margin: 0;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--el-fill-color-darker);
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
}

.article-quote {
  margin: 0 0 18px;
  padding: 10px 16px;
  border-left: 3px solid var(--el-color-primary-light-5);
  background: var(--el-fill-color-light);
  border-radius: 0 10px 10px 0;
}

.article-quote p {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.article-quote footer {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.article-callout {
  margin-bottom: 18px;
  border-radius: 10px;
}

.article-image {
  margin: 0 0 18px;
}

.article-image img {
  display: block;
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-lighter);
}

.article-image figcaption {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.article-divider {
  margin: 22px 0;
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
