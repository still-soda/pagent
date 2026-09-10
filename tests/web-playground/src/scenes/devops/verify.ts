import { assert, assertEqual } from '../../oracle/checks'
import type { CheckOutcome } from '../../oracle/types'
import type { EnvConfigItem, MicroService, PodInstance } from './types'

export interface DevOpsSnapshot {
  services: MicroService[]
  envConfigs: EnvConfigItem[]
  pods: PodInstance[]
  pipelineStatus: 'idle' | 'running' | 'failed' | 'success'
}

const REDIS_VALUE = 'redis-cluster.internal:6379'

export function verifyDevOps(snapshot: DevOpsSnapshot): CheckOutcome[] {
  const payment = snapshot.services.find((service) => service.id === 'svc-payment')
  const redis = snapshot.envConfigs.find((item) => item.key.trim() === 'REDIS_HOST')
  const readyPods = snapshot.pods.filter((pod) => pod.ready && pod.status === 'Running')

  return [
    assert(
      'service',
      '已选定 payment-service',
      payment != null,
      'payment-service',
      payment?.name ?? '未找到',
    ),
    assertEqual(
      'redis',
      'ConfigMap 含 REDIS_HOST = redis-cluster.internal:6379',
      REDIS_VALUE,
      redis?.value.trim() ?? '',
    ),
    assertEqual('pipeline', '发布流水线已成功', 'success', snapshot.pipelineStatus),
    assert(
      'pods',
      '3 个 Pod 副本全部就绪',
      readyPods.length >= 3,
      '3 个 Running',
      `${readyPods.length} 个就绪`,
    ),
    assertEqual('traffic', '灰度流量切至 100%', 100, payment?.trafficWeight ?? 0),
  ]
}
