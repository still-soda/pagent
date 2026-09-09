export type NamespaceType = 'prod-core' | 'prod-biz' | 'infra'

export interface MicroService {
  id: string
  name: string
  namespace: NamespaceType
  currentVersion: string
  targetVersion: string
  status: 'healthy' | 'deploying' | 'failed' | 'warning'
  replicas: number
  readyReplicas: number
  cpuUsage: number // 百分比
  memoryUsage: number // MB
  lastDeployed: string
  trafficWeight: number // 灰度比例 0-100
}

export interface PodInstance {
  name: string
  namespace: NamespaceType
  status: 'Running' | 'CrashLoopBackOff' | 'Pending' | 'Terminating'
  ready: boolean
  restarts: number
  node: string
  ip: string
  startTime: string
}

export interface TerminalLog {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  podName: string
  traceId: string
  thread: string
  logger: string
  message: string
}

export interface EnvConfigItem {
  key: string
  value: string
  description: string
  isSecret: boolean
}
