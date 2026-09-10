import { ref } from 'vue'
import type { SavedDoc } from './types'

const STORAGE_KEY = 'pagent-knowledge-base-docs'

function load(): SavedDoc[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedDoc[]) : []
  } catch {
    return []
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs.value))
}

const docs = ref<SavedDoc[]>(load())

const resetEpoch = ref(0)

export function useDocsStore() {
  function save(doc: SavedDoc) {
    const index = docs.value.findIndex((item) => item.id === doc.id)
    if (index >= 0) {
      docs.value[index] = doc
    } else {
      docs.value.unshift(doc)
    }
    persist()
  }

  function remove(id: string) {
    docs.value = docs.value.filter((item) => item.id !== id)
    persist()
  }

  function get(id: string): SavedDoc | undefined {
    return docs.value.find((item) => item.id === id)
  }

  function clearAll() {
    docs.value = []
    persist()
    resetEpoch.value += 1
  }

  return { docs, save, remove, get, clearAll, resetEpoch }
}
