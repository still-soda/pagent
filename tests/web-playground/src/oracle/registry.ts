import { shallowRef } from 'vue'
import type { PagentOracleApi, SceneOracle } from './types'

export const activeOracle = shallowRef<SceneOracle | null>(null)

const api: PagentOracleApi = {
  getSceneId: () => activeOracle.value?.sceneId ?? null,
  verify: () => activeOracle.value?.verify() ?? [],
  reset: () => {
    activeOracle.value?.reset()
  },
}

if (typeof window !== 'undefined') {
  window.__pagentOracle = api
}

export function registerOracle(oracle: SceneOracle) {
  activeOracle.value = oracle
}

export function unregisterOracle(oracle: SceneOracle) {
  if (activeOracle.value === oracle) {
    activeOracle.value = null
  }
}
