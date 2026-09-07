<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Document, Edit } from '@element-plus/icons-vue'
import DocEditor from '../components/DocEditor.vue'
import type { EditorPayload } from '../components/DocEditor.vue'
import { useDocsStore } from '../store'
import type { SavedDoc } from '../types'

const TAG_POOL = ['发布', '评审', '简报', '3.0', '数据', '风险', '预算', '协作', '周报']

const route = useRoute()
const router = useRouter()
const { docs, save, remove, get } = useDocsStore()

const editorRef = ref<InstanceType<typeof DocEditor> | null>(null)
const title = ref('')
const tags = ref<string[]>([])
const wordCount = ref(0)
const latestHtml = ref('')
const latestText = ref('')
const dirty = ref(false)
const editingId = ref<string | null>(null)
const savedAt = ref<number | null>(null)

const editingDoc = computed(() =>
  docs.value.find((item) => item.id === editingId.value),
)

function onEditorUpdate(payload: EditorPayload) {
  wordCount.value = payload.wordCount
  latestHtml.value = payload.html
  latestText.value = payload.text
  dirty.value = true
}

function loadDoc(doc: SavedDoc) {
  editingId.value = doc.id
  title.value = doc.title
  tags.value = [...doc.tags]
  editorRef.value?.setContent(doc.html)
  wordCount.value = doc.wordCount
  latestHtml.value = doc.html
  latestText.value = doc.text
  savedAt.value = doc.updatedAt
  dirty.value = false
  router.replace({ query: { doc: doc.id } })
}

function startNewDoc() {
  editingId.value = null
  title.value = ''
  tags.value = []
  editorRef.value?.clearContent()
  wordCount.value = 0
  latestHtml.value = ''
  savedAt.value = null
  dirty.value = false
  router.replace({ query: {} })
  ElMessage.info('已切换到新建文档')
}

function saveDoc() {
  const trimmedTitle = title.value.trim()
  if (trimmedTitle.length < 2) {
    ElMessage.error('请先填写文档标题（至少 2 个字符）')
    return
  }
  if (wordCount.value < 50) {
    ElMessage.error('正文内容过短，至少 50 字')
    return
  }

  const now = Date.now()
  const existing = editingId.value ? get(editingId.value) : undefined
  const doc: SavedDoc = {
    id: existing?.id ?? `doc-${now}`,
    title: trimmedTitle,
    tags: [...tags.value],
    html: latestHtml.value,
    text: latestText.value,
    wordCount: wordCount.value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  save(doc)
  editingId.value = doc.id
  savedAt.value = now
  dirty.value = false
  router.replace({ query: { doc: doc.id } })
  ElMessage.success('文档已保存')
}

async function deleteDoc(id: string) {
  try {
    await ElMessageBox.confirm('删除后无法恢复，确定删除该文档吗？', '删除文档', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  remove(id)
  if (editingId.value === id) {
    startNewDoc()
  }
  ElMessage.success('文档已删除')
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

onMounted(() => {
  const docId = route.query.doc as string | undefined
  if (docId) {
    const doc = get(docId)
    if (doc) {
      loadDoc(doc)
      return
    }
  }
  // 组件挂载后编辑器才就绪，标记初始状态
  dirty.value = false
})
</script>

<template>
  <div class="write-page">
    <div class="write-main">
      <input
        v-model="title"
        class="doc-title-input"
        type="text"
        placeholder="请输入文档标题"
        aria-label="文档标题"
        data-field="doc-title"
      />

      <div class="tag-row">
        <el-select
          v-model="tags"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="添加标签（可自定义）"
          aria-label="文档标签"
          data-field="doc-tags"
          class="tag-select"
        >
          <el-option v-for="tag in TAG_POOL" :key="tag" :label="tag" :value="tag" />
        </el-select>
      </div>

      <DocEditor ref="editorRef" @update="onEditorUpdate" />

      <div class="write-footer">
        <span class="save-status">
          <template v-if="dirty">有未保存更改</template>
          <template v-else-if="savedAt">已于 {{ formatTime(savedAt) }} 保存</template>
          <template v-else>尚未保存</template>
        </span>
        <span class="word-count">{{ wordCount }} 字</span>
        <el-button type="primary" data-action="save-doc" @click="saveDoc">
          保存文档
        </el-button>
      </div>
    </div>

    <aside class="my-docs">
      <div class="my-docs-header">
        <span class="my-docs-title">
          <el-icon :size="14"><Document /></el-icon>
          我的文档
        </span>
        <el-button
          type="primary"
          link
          size="small"
          data-action="new-doc"
          @click="startNewDoc"
        >
          新建
        </el-button>
      </div>

      <el-empty
        v-if="docs.length === 0"
        description="暂无文档，写一篇吧"
        :image-size="72"
      />

      <div v-else class="doc-list">
        <div
          v-for="doc in docs"
          :key="doc.id"
          class="doc-item"
          :class="{ active: doc.id === editingId }"
        >
          <button type="button" class="doc-item-main" @click="loadDoc(doc)">
            <span class="doc-item-title">{{ doc.title }}</span>
            <span class="doc-item-meta">
              {{ formatTime(doc.updatedAt) }} · {{ doc.wordCount }} 字
            </span>
            <span v-if="doc.tags.length" class="doc-item-tags">
              {{ doc.tags.map((tag) => `# ${tag}`).join(' ') }}
            </span>
          </button>
          <span class="doc-item-actions">
            <el-tooltip content="编辑" placement="top">
              <button
                type="button"
                class="icon-action"
                aria-label="编辑文档"
                @click="loadDoc(doc)"
              >
                <el-icon :size="13"><Edit /></el-icon>
              </button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <button
                type="button"
                class="icon-action danger"
                aria-label="删除文档"
                @click="deleteDoc(doc.id)"
              >
                <el-icon :size="13"><Delete /></el-icon>
              </button>
            </el-tooltip>
          </span>
        </div>
      </div>

      <div v-if="editingDoc" class="editing-hint">
        当前编辑：{{ editingDoc.title }}
      </div>
    </aside>
  </div>
</template>

<style scoped>
.write-page {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.write-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.doc-title-input {
  width: 100%;
  padding: 10px 2px;
  border: none;
  border-bottom: 1px solid var(--el-border-color-light);
  background: transparent;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  outline: none;
  transition: border-color 0.2s;
}

.doc-title-input:focus {
  border-bottom-color: var(--el-color-primary);
}

.doc-title-input::placeholder {
  color: var(--el-text-color-placeholder);
  font-weight: 500;
}

.tag-row {
  display: flex;
}

.tag-select {
  width: 100%;
}

.write-footer {
  display: flex;
  align-items: center;
  gap: 14px;
  justify-content: flex-end;
}

.save-status {
  margin-right: auto;
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.word-count {
  font-size: 12.5px;
  color: var(--el-text-color-secondary);
}

.my-docs {
  flex: none;
  width: 250px;
  padding: 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  background: var(--el-bg-color);
}

.my-docs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.my-docs-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.doc-item {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  transition: border-color 0.15s, background-color 0.15s;
}

.doc-item:hover {
  border-color: var(--el-color-primary-light-5);
}

.doc-item.active {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.doc-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.doc-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-item-meta {
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

.doc-item-tags {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.doc-item-actions {
  display: inline-flex;
  gap: 2px;
}

.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.icon-action:hover {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}

.icon-action.danger:hover {
  color: var(--el-color-danger);
}

.editing-hint {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  font-size: 11.5px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 900px) {
  .write-page {
    flex-direction: column;
  }

  .my-docs {
    width: 100%;
  }
}
</style>
