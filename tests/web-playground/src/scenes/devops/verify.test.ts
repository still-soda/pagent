import { describe, expect, it } from 'vitest'
import { initialEnvConfigs, initialServices, samplePods } from './data'
import { verifyDevOps } from './verify'

describe('verifyDevOps', () => {
  it('fails the initial cluster state', () => {
    const outcomes = verifyDevOps({
      services: JSON.parse(JSON.stringify(initialServices)),
      envConfigs: JSON.parse(JSON.stringify(initialEnvConfigs)),
      pods: JSON.parse(JSON.stringify(samplePods)),
      pipelineStatus: 'idle',
    })
    expect(outcomes.find((item) => item.id === 'pipeline')?.status).toBe('fail')
    expect(outcomes.find((item) => item.id === 'traffic')?.status).toBe('fail')
  })

  it('passes after redis, healthy rollout and 100% traffic', () => {
    const services = JSON.parse(JSON.stringify(initialServices))
    const payment = services.find((item: { id: string }) => item.id === 'svc-payment')
    payment.trafficWeight = 100
    const envConfigs = JSON.parse(JSON.stringify(initialEnvConfigs))
    envConfigs.push({
      key: 'REDIS_HOST',
      value: 'redis-cluster.internal:6379',
      description: '',
      isSecret: false,
    })
    const pods = JSON.parse(JSON.stringify(samplePods)).map((pod: { ready: boolean; status: string }) => ({
      ...pod,
      ready: true,
      status: 'Running',
    }))

    const outcomes = verifyDevOps({
      services,
      envConfigs,
      pods,
      pipelineStatus: 'success',
    })
    expect(outcomes.every((item) => item.status === 'pass')).toBe(true)
  })
})
