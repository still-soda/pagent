export type CheckStatus = 'pass' | 'fail' | 'unknown'

export interface CheckOutcome {
  id: string
  label: string
  status: CheckStatus
  expected?: string
  actual?: string
}

export interface SceneOracle {
  sceneId: string
  verify: () => CheckOutcome[]
  reset: () => void
}

export interface PagentOracleApi {
  getSceneId: () => string | null
  verify: () => CheckOutcome[]
  reset: () => void
}

declare global {
  interface Window {
    __pagentOracle?: PagentOracleApi
  }
}

export {}
