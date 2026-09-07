<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { TaskItem, TaskList } from '@tiptap/extension-list'

export interface EditorPayload {
  html: string
  text: string
  wordCount: number
}

const emit = defineEmits<{ update: [payload: EditorPayload] }>()

const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,
    TableKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: '开始撰写文档，支持标题、列表、表格与待办清单…',
    }),
  ],
  onUpdate: () => {
    if (!editor.value) return
    const text = editor.value.getText()
    emit('update', {
      html: editor.value.getHTML(),
      text,
      wordCount: text.replace(/\s/g, '').length,
    })
  },
})

function setContent(html: string) {
  editor.value?.commands.setContent(html, { emitUpdate: false })
}

function clearContent() {
  editor.value?.commands.clearContent(true)
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})

defineExpose({ setContent, clearContent })
</script>

<template>
  <div class="doc-editor">
    <div v-if="editor" class="editor-toolbar">
      <div class="toolbar-group">
        <button
          type="button"
          class="tool-btn"
          title="撤销"
          aria-label="撤销"
          :disabled="!editor.can().undo()"
          @click="editor.chain().focus().undo().run()"
        >
          ↶
        </button>
        <button
          type="button"
          class="tool-btn"
          title="重做"
          aria-label="重做"
          :disabled="!editor.can().redo()"
          @click="editor.chain().focus().redo().run()"
        >
          ↷
        </button>
      </div>

      <div class="toolbar-group">
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('heading', { level: 1 }) }"
          title="一级标题"
          aria-label="一级标题"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          H1
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('heading', { level: 2 }) }"
          title="二级标题"
          aria-label="二级标题"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          H2
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('heading', { level: 3 }) }"
          title="三级标题"
          aria-label="三级标题"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          H3
        </button>
      </div>

      <div class="toolbar-group">
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('bold') }"
          title="加粗"
          aria-label="加粗"
          @click="editor.chain().focus().toggleBold().run()"
        >
          B
        </button>
        <button
          type="button"
          class="tool-btn italic"
          :class="{ active: editor.isActive('italic') }"
          title="斜体"
          aria-label="斜体"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          I
        </button>
        <button
          type="button"
          class="tool-btn strike"
          :class="{ active: editor.isActive('strike') }"
          title="删除线"
          aria-label="删除线"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          S
        </button>
      </div>

      <div class="toolbar-group">
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('bulletList') }"
          title="无序列表"
          aria-label="无序列表"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          •≡
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('orderedList') }"
          title="有序列表"
          aria-label="有序列表"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          1≡
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('taskList') }"
          title="任务清单"
          aria-label="任务清单"
          @click="editor.chain().focus().toggleTaskList().run()"
        >
          ☑
        </button>
      </div>

      <div class="toolbar-group">
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('blockquote') }"
          title="引用"
          aria-label="引用"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          ❝
        </button>
        <button
          type="button"
          class="tool-btn"
          :class="{ active: editor.isActive('codeBlock') }"
          title="代码块"
          aria-label="代码块"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          &#123;&#125;
        </button>
        <button
          type="button"
          class="tool-btn"
          title="插入表格"
          aria-label="插入表格"
          @click="editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"
        >
          ⊞
        </button>
        <button
          type="button"
          class="tool-btn"
          title="分割线"
          aria-label="插入分割线"
          @click="editor.chain().focus().setHorizontalRule().run()"
        >
          —
        </button>
        <button
          type="button"
          class="tool-btn"
          title="清除格式"
          aria-label="清除格式"
          @click="editor.chain().focus().unsetAllMarks().clearNodes().run()"
        >
          ⌫
        </button>
      </div>
    </div>

    <EditorContent :editor="editor" class="editor-body" />
  </div>
</template>

<style scoped>
.doc-editor {
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  overflow: hidden;
  background: var(--el-bg-color);
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-lighter);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-right: 8px;
  margin-right: 4px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.toolbar-group:last-child {
  border-right: none;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.tool-btn:hover:not(:disabled) {
  background: var(--el-fill-color);
  color: var(--el-color-primary);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.tool-btn.italic {
  font-style: italic;
}

.tool-btn.strike {
  text-decoration: line-through;
}

.editor-body :deep(.tiptap) {
  min-height: 380px;
  padding: 18px 22px;
  outline: none;
  font-size: 14px;
  line-height: 1.9;
  color: var(--el-text-color-primary);
}

.editor-body :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--el-text-color-placeholder);
}

.editor-body :deep(.tiptap h1) {
  font-size: 22px;
  font-weight: 600;
  margin: 18px 0 10px;
}

.editor-body :deep(.tiptap h2) {
  font-size: 19px;
  font-weight: 600;
  margin: 16px 0 8px;
}

.editor-body :deep(.tiptap h3) {
  font-size: 16px;
  font-weight: 600;
  margin: 14px 0 8px;
}

.editor-body :deep(.tiptap ul),
.editor-body :deep(.tiptap ol) {
  padding-left: 22px;
  margin: 8px 0;
}

.editor-body :deep(.tiptap blockquote) {
  margin: 10px 0;
  padding: 6px 14px;
  border-left: 3px solid var(--el-color-primary-light-5);
  background: var(--el-fill-color-light);
  border-radius: 0 8px 8px 0;
  color: var(--el-text-color-regular);
}

.editor-body :deep(.tiptap pre) {
  margin: 10px 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-darker);
  font-size: 12.5px;
  line-height: 1.7;
  overflow-x: auto;
}

.editor-body :deep(.tiptap code) {
  background: var(--el-fill-color);
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 0.9em;
}

.editor-body :deep(.tiptap pre code) {
  background: transparent;
  padding: 0;
}

.editor-body :deep(.tiptap table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 13px;
}

.editor-body :deep(.tiptap th),
.editor-body :deep(.tiptap td) {
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  text-align: left;
}

.editor-body :deep(.tiptap th) {
  background: var(--el-fill-color-light);
  font-weight: 600;
}

.editor-body :deep(.tiptap ul[data-type='taskList']) {
  padding-left: 4px;
  list-style: none;
}

.editor-body :deep(.tiptap ul[data-type='taskList'] li) {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.editor-body :deep(.tiptap ul[data-type='taskList'] input[type='checkbox']) {
  margin-top: 6px;
  accent-color: var(--el-color-primary);
}

.editor-body :deep(.tiptap hr) {
  margin: 16px 0;
  border: none;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
