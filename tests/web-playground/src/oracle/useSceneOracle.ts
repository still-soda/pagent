import { onBeforeUnmount, onMounted } from 'vue'
import { registerOracle, unregisterOracle } from './registry'
import type { CheckOutcome, SceneOracle } from './types'

export function useSceneOracle(
  sceneId: string,
  handlers: {
    verify: () => CheckOutcome[]
    reset: () => void
  },
) {
  const oracle: SceneOracle = {
    sceneId,
    verify: () => handlers.verify(),
    reset: () => handlers.reset(),
  }

  onMounted(() => registerOracle(oracle))
  onBeforeUnmount(() => unregisterOracle(oracle))
}
