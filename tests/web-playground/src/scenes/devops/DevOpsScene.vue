<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useSceneOracle } from '../../oracle'
import { verifyDevOps } from './verify'
import {
  Check,
  Delete,
  Monitor,
  Plus,
  RefreshRight,
  Search,
  WarningFilled,
} from '@element-plus/icons-vue'
import { baseTerminalLogs, initialEnvConfigs, initialServices, samplePods } from './data'
import type { EnvConfigItem, MicroService, PodInstance, TerminalLog } from './types'

/* ---------- 集群与服务总览 ---------- */
const activeTab = ref<'catalog' | 'pipeline' | 'terminal' | 'config' | 'traffic'>('catalog')
const services = reactive<MicroService[]>(JSON.parse(JSON.stringify(initialServices)))
const selectedNamespace = ref<string>('all')
const serviceSearch = ref<string>('')

const selectedServiceId = ref<string>('svc-payment')
const selectedService = computed(
  () => services.find((s) => s.id === selectedServiceId.value) ?? services[0],
)

const filteredServices = computed(() => {
  return services.filter((svc) => {
    if (selectedNamespace.value !== 'all' && svc.namespace !== selectedNamespace.value) return false
    if (serviceSearch.value.trim() && !svc.name.toLowerCase().includes(serviceSearch.value.trim().toLowerCase())) {
      return false
    }
    return true
  })
})

function selectServiceAndGo(service: MicroService, tab: typeof activeTab.value = 'pipeline') {
  selectedServiceId.value = service.id
  activeTab.value = tab
  ElMessage.info(`已选定微服务：${service.name}，进入【${tabName(tab)}】`)
}

function tabName(t: typeof activeTab.value): string {
  switch (t) {
    case 'catalog': return '服务总览'
    case 'pipeline': return '发布流水线'
    case 'terminal': return '实例与终端诊断'
    case 'config': return '环境配置中心'
    case 'traffic': return '网关与流量控制'
  }
}

function statusLabel(status: MicroService['status']) {
  if (status === 'healthy') return 'Running'
  if (status === 'deploying') return 'Updating'
  if (status === 'warning') return 'Warning'
  return 'Failed'
}

function stageClass(index: number) {
  if (pipelineStatus.value === 'idle' && currentStepIndex.value === 0) return ''
  if (pipelineStatus.value === 'failed' && index === 3) return 'failed'
  if (currentStepIndex.value > index || pipelineStatus.value === 'success') return 'done'
  if (pipelineStatus.value === 'running' && currentStepIndex.value === index) return 'running'
  return ''
}

/* ---------- 部署流水线状态 ---------- */
type PipelineStatus = 'idle' | 'running' | 'failed' | 'success'
const pipelineStatus = ref<PipelineStatus>('idle')
const currentStepIndex = ref(0)
const deployVersion = ref('v2.4.0')

/* ---------- Pod 实例与终端日志数据 ---------- */
const pods = ref<PodInstance[]>(JSON.parse(JSON.stringify(samplePods)))
const logs = ref<TerminalLog[]>(JSON.parse(JSON.stringify(baseTerminalLogs)))
const logFilterLevel = ref<string>('all')

const filteredLogs = computed(() => {
  if (logFilterLevel.value === 'all') return logs.value
  return logs.value.filter((l) => l.level === logFilterLevel.value)
})

function appendLog(level: TerminalLog['level'], message: string) {
  const now = new Date().toTimeString().slice(0, 8) + '.' + String(Date.now() % 1000).padStart(3, '0')
  logs.value.unshift({
    timestamp: now,
    level,
    podName: 'payment-service-7f8d9b-z55yt',
    traceId: `trace-${Math.random().toString(16).slice(2, 10)}`,
    thread: 'k8s-probe-worker-1',
    logger: 'com.xinglan.payment.health.LivenessProbe',
    message,
  })
}

/* ---------- 环境配置中心 ---------- */
const envConfigs = reactive<EnvConfigItem[]>(JSON.parse(JSON.stringify(initialEnvConfigs)))
const envSearch = ref('')

const filteredEnvConfigs = computed(() => {
  if (!envSearch.value.trim()) return envConfigs
  const q = envSearch.value.trim().toLowerCase()
  return envConfigs.filter((e) => e.key.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
})

function addEnvItem() {
  envConfigs.unshift({
    key: '',
    value: '',
    description: '自定义业务运行配置项',
    isSecret: false,
  })
}

function removeEnvItem(idx: number) {
  envConfigs.splice(idx, 1)
}

function saveEnvConfigs() {
  ElMessage.success('生产 ConfigMap 已提交并热加载生效')
  appendLog('info', 'Kubernetes ConfigMap [payment-service-config] updated successfully.')
}

/* ---------- 流量控制 ---------- */
const trafficSlider = ref(10)

function applyTrafficRule() {
  selectedService.value.trafficWeight = trafficSlider.value
  ElMessage.success(`Ingress 网关流量切分规则已更新：当前生产流量权重为 ${trafficSlider.value}%`)
  appendLog('info', `Ingress route weight updated: payment-service canary weight = ${trafficSlider.value}%`)
}

/* ---------- 执行部署流水线 ---------- */
let deployGeneration = 0

async function startDeploy() {
  const generation = ++deployGeneration
  const stillCurrent = () => generation === deployGeneration

  pipelineStatus.value = 'running'
  selectedService.value.status = 'deploying'
  currentStepIndex.value = 0
  appendLog('info', `Deploy pipeline triggered for [${selectedService.value.name}] target version: ${deployVersion.value}`)

  // 步骤 1: 源码编译拉取
  await new Promise((r) => setTimeout(r, 800))
  if (!stillCurrent()) return
  currentStepIndex.value = 1
  appendLog('info', 'Source checkout: commit 7f8d9b (feat: optimize settlement state machine). Build OK.')

  // 步骤 2: Docker 镜像构建
  await new Promise((r) => setTimeout(r, 900))
  if (!stillCurrent()) return
  currentStepIndex.value = 2
  appendLog('info', 'Image build: registry.xinglan.internal/prod-core/payment-service:v2.4.0 verified.')

  // 步骤 3: Kubernetes 调度
  await new Promise((r) => setTimeout(r, 1000))
  if (!stillCurrent()) return
  currentStepIndex.value = 3
  appendLog('info', 'Kubernetes Deployment rolling update started. 3 new pods provisioned.')

  // 步骤 4: 检查探针
  await new Promise((r) => setTimeout(r, 1100))
  if (!stillCurrent()) return

  const hasRedis = envConfigs.some(
    (e) => e.key.trim() === 'REDIS_HOST' && e.value.trim().length > 0,
  )

  if (!hasRedis) {
    pipelineStatus.value = 'failed'
    selectedService.value.status = 'failed'

    // Pod 3 崩溃
    pods.value[2].status = 'CrashLoopBackOff'
    pods.value[2].ready = false
    pods.value[2].restarts = 4

    const fatalLog =
      'FATAL ERROR: Pod payment-service-7f8d9b-z55yt failed livenessProbe: dial tcp connection refused. Missing required environment variable "REDIS_HOST". Cannot connect to distributed lock cluster.'
    console.error(`[DevOpsConsole] ${fatalLog}`)
    appendLog('error', fatalLog)
    appendLog('warn', 'Deployment rolling update halted! Please switch to [环境配置中心] to supply REDIS_HOST.')

    try {
      fetch('/api/mock/deploy-probe-error', {
        headers: { 'X-Pagent-Error': 'Missing REDIS_HOST in ConfigMap' },
      }).catch(() => {})
    } catch {}

    ElMessage.error('健康检查探针超时失败！请切换至「实例与终端诊断」查看排障日志并在「环境配置中心」修复')
  } else {
    pipelineStatus.value = 'success'
    selectedService.value.status = 'healthy'
    selectedService.value.currentVersion = deployVersion.value

    pods.value.forEach((p) => {
      p.status = 'Running'
      p.ready = true
      p.restarts = 0
    })

    appendLog('info', 'All 3/3 pods passed liveness/readiness probes. Version v2.4.0 successfully active.')
    ElMessage.success('部署流水线全部通过！请切换至「网关与流量控制」将流量切至 100% 完成全量上线')
  }
}

function replaceArray<T>(target: T[], next: T[]) {
  target.splice(0, target.length, ...next)
}

function resetDevOps() {
  deployGeneration += 1
  activeTab.value = 'catalog'
  replaceArray(services, JSON.parse(JSON.stringify(initialServices)))
  selectedNamespace.value = 'all'
  serviceSearch.value = ''
  selectedServiceId.value = 'svc-payment'
  pipelineStatus.value = 'idle'
  currentStepIndex.value = 0
  deployVersion.value = 'v2.4.0'
  pods.value = JSON.parse(JSON.stringify(samplePods))
  logs.value = JSON.parse(JSON.stringify(baseTerminalLogs))
  logFilterLevel.value = 'all'
  replaceArray(envConfigs, JSON.parse(JSON.stringify(initialEnvConfigs)))
  envSearch.value = ''
  trafficSlider.value = 10
}

useSceneOracle('devops', {
  verify: () =>
    verifyDevOps({
      services,
      envConfigs,
      pods: pods.value,
      pipelineStatus: pipelineStatus.value,
    }),
  reset: resetDevOps,
})
</script>

<template>
  <div class="devops-workbench">
    <header class="cluster-bar">
      <div class="crumb">
        <el-icon :size="14"><Monitor /></el-icon>
        <span>prod-east2</span>
        <span class="sep">/</span>
        <span>{{ selectedService.namespace }}</span>
        <span class="sep">/</span>
        <span class="crumb-svc">{{ selectedService.name }}</span>
      </div>
      <div class="cluster-meta">
        <span>Kubernetes 1.30.2</span>
        <span class="dot" />
        <span>24 nodes</span>
        <span class="dot" />
        <span>{{ services.length }} services</span>
        <span class="status-chip" :class="selectedService.status">
          {{ statusLabel(selectedService.status) }}
        </span>
        <span class="weight">canary {{ selectedService.trafficWeight }}%</span>
      </div>
    </header>

    <div class="console-tabs">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="服务总览" name="catalog" />
        <el-tab-pane label="发布流水线" name="pipeline" />
        <el-tab-pane label="实例与终端诊断" name="terminal" />
        <el-tab-pane label="环境配置中心" name="config" />
        <el-tab-pane label="网关与流量控制" name="traffic" />
      </el-tabs>
    </div>

    <section v-if="activeTab === 'catalog'" class="tab-pane-view">
      <div class="catalog-toolbar">
        <div class="ns-filters">
          <button
            v-for="ns in [
              { id: 'all', label: '全部' },
              { id: 'prod-core', label: 'prod-core' },
              { id: 'prod-biz', label: 'prod-biz' },
              { id: 'infra', label: 'infra' },
            ]"
            :key="ns.id"
            type="button"
            class="ns-chip"
            :class="{ active: selectedNamespace === ns.id }"
            @click="selectedNamespace = ns.id"
          >
            {{ ns.label }}
          </button>
        </div>
        <el-input
          v-model="serviceSearch"
          placeholder="按服务名过滤"
          :prefix-icon="Search"
          clearable
          size="small"
          style="width: 220px"
        />
      </div>

      <div class="table-wrap">
        <el-table
          :data="filteredServices"
          style="width: 100%"
          size="small"
          highlight-current-row
          :row-class-name="(data: { row: MicroService }) => (data.row.id === selectedServiceId ? 'is-selected' : '')"
          @row-click="(row: MicroService) => (selectedServiceId = row.id)"
        >
          <el-table-column prop="name" label="服务" min-width="200">
            <template #default="{ row }">
              <span class="svc-name">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="namespace" label="命名空间" width="120">
            <template #default="{ row }">
              <span class="ns-text">{{ row.namespace }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="currentVersion" label="版本" width="100">
            <template #default="{ row }">
              <span class="code-font">{{ row.currentVersion }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="120">
            <template #default="{ row }">
              <span class="status-dot" :class="row.status" />
              {{ statusLabel(row.status) }}
            </template>
          </el-table-column>
          <el-table-column label="Ready" width="90" align="center">
            <template #default="{ row }">
              {{ row.readyReplicas }}/{{ row.replicas }}
            </template>
          </el-table-column>
          <el-table-column prop="cpuUsage" label="CPU" width="140">
            <template #default="{ row }">
              <div class="cpu-cell">
                <span class="cpu-bar"><i :style="{ width: row.cpuUsage + '%' }" /></span>
                <span>{{ row.cpuUsage }}%</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="trafficWeight" label="流量" width="80" align="center">
            <template #default="{ row }">{{ row.trafficWeight }}%</template>
          </el-table-column>
          <el-table-column prop="lastDeployed" label="最近发布" width="170" />
          <el-table-column label="" width="170" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click.stop="selectServiceAndGo(row, 'pipeline')">
                发布流水线
              </el-button>
              <el-button type="primary" link size="small" @click.stop="selectServiceAndGo(row, 'config')">
                配置中心
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section v-else-if="activeTab === 'pipeline'" class="tab-pane-view pipeline-view">
      <div class="deploy-toolbar">
        <label>
          服务
          <el-select v-model="selectedServiceId" size="small" style="width: 200px">
            <el-option v-for="s in services" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </label>
        <label>
          目标版本
          <el-select v-model="deployVersion" size="small" style="width: 180px">
            <el-option label="v2.4.0" value="v2.4.0" />
            <el-option label="v2.4.1-rc1" value="v2.4.1-rc1" />
            <el-option label="v2.3.0" value="v2.3.0" />
          </el-select>
        </label>
        <span class="running-ver">当前 {{ selectedService.currentVersion }}</span>
        <el-button
          id="btn-trigger-deploy"
          type="primary"
          size="small"
          :loading="pipelineStatus === 'running'"
          @click="startDeploy"
        >
          {{ pipelineStatus === 'failed' ? '重新执行发布' : '开始灰度发布' }}
        </el-button>
      </div>

      <div class="pipeline-board">
        <div class="pipe-stage" :class="stageClass(0)">
          <div class="pipe-name">Build</div>
          <div class="pipe-desc">源码拉取与编译</div>
        </div>
        <div class="pipe-arrow">→</div>
        <div class="pipe-stage" :class="stageClass(1)">
          <div class="pipe-name">Package</div>
          <div class="pipe-desc">镜像构建与扫描</div>
        </div>
        <div class="pipe-arrow">→</div>
        <div class="pipe-stage" :class="stageClass(2)">
          <div class="pipe-name">Rollout</div>
          <div class="pipe-desc">Pod 滚动更新</div>
        </div>
        <div class="pipe-arrow">→</div>
        <div class="pipe-stage" :class="[stageClass(3), { failed: pipelineStatus === 'failed' }]">
          <div class="pipe-name">Health</div>
          <div class="pipe-desc">存活与健康检查</div>
        </div>
      </div>

      <div v-if="pipelineStatus === 'failed'" class="console-alert is-error">
        <el-icon :size="16"><WarningFilled /></el-icon>
        <div>
          <strong>job failed · livenessProbe timeout</strong>
          <p>
            payment-service-7f8d9b-z55yt CrashLoopBackOff。查看
            <button type="button" class="text-link" @click="activeTab = 'terminal'">实例与终端诊断</button>
            日志，并在
            <button type="button" class="text-link" @click="activeTab = 'config'">环境配置中心</button>
            补全缺失变量后重跑。
          </p>
        </div>
      </div>

      <div v-else-if="pipelineStatus === 'success'" class="console-alert is-ok">
        <el-icon :size="16"><Check /></el-icon>
        <div>
          <strong>{{ deployVersion }} 已就绪 · 3/3 Ready</strong>
          <p>
            到
            <button type="button" class="text-link" @click="activeTab = 'traffic'">网关与流量控制</button>
            把灰度权重调到 100% 完成上线。
          </p>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'terminal'" class="tab-pane-view terminal-view">
      <div class="pods-strip">
        <div class="strip-title">
          Pods
          <span>{{ pods.filter((p) => p.ready).length }}/{{ pods.length }} Ready</span>
        </div>
        <el-table :data="pods" size="small" style="width: 100%">
          <el-table-column prop="name" label="NAME" min-width="240">
            <template #default="{ row }">
              <span class="code-font">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="STATUS" width="160">
            <template #default="{ row }">
              <span class="status-dot" :class="row.ready ? 'healthy' : 'failed'" />
              {{ row.status }}
            </template>
          </el-table-column>
          <el-table-column prop="restarts" label="RESTARTS" width="100" align="center">
            <template #default="{ row }">
              <span :class="{ 'text-danger': row.restarts > 0 }">{{ row.restarts }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="ip" label="IP" width="130" />
          <el-table-column prop="node" label="NODE" min-width="180" />
          <el-table-column prop="startTime" label="AGE" width="160" />
        </el-table>
      </div>

      <div class="log-panel">
        <div class="log-toolbar">
          <span class="log-path">kubectl logs -f {{ selectedService.name }} --tail=200</span>
          <div class="term-controls">
            <el-radio-group v-model="logFilterLevel" size="small">
              <el-radio-button label="all">all</el-radio-button>
              <el-radio-button label="info">info</el-radio-button>
              <el-radio-button label="warn">warn</el-radio-button>
              <el-radio-button label="error">error</el-radio-button>
            </el-radio-group>
            <el-button size="small" :icon="RefreshRight" link @click="appendLog('info', 'Manual poll buffer sync OK')">
              刷新
            </el-button>
          </div>
        </div>
        <div id="k8s-log-terminal" class="terminal-console">
          <div
            v-for="(item, idx) in filteredLogs"
            :key="idx"
            class="console-row"
            :class="`level-${item.level}`"
          >
            <span class="ts">{{ item.timestamp }}</span>
            <span class="lvl">{{ item.level.toUpperCase() }}</span>
            <span class="trace">{{ item.traceId }}</span>
            <span class="log-msg">{{ item.message }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'config'" class="tab-pane-view">
      <div class="config-toolbar">
        <div class="cfg-path">
          ConfigMap
          <span>payment-service-config</span>
          · {{ selectedService.namespace }}
        </div>
        <div class="cfg-actions">
          <el-input
            v-model="envSearch"
            placeholder="搜索 KEY，如 REDIS"
            :prefix-icon="Search"
            size="small"
            clearable
            style="width: 220px"
          />
          <el-button size="small" :icon="Plus" @click="addEnvItem">添加环境变量</el-button>
          <el-button id="btn-save-configs" type="primary" size="small" @click="saveEnvConfigs">
            保存并热加载配置
          </el-button>
        </div>
      </div>

      <div class="table-wrap">
        <el-table :data="filteredEnvConfigs" size="small" style="width: 100%">
          <el-table-column prop="key" label="KEY" min-width="220">
            <template #default="{ row }">
              <el-input v-model="row.key" placeholder="REDIS_HOST" size="small" />
            </template>
          </el-table-column>
          <el-table-column prop="value" label="VALUE" min-width="300">
            <template #default="{ row }">
              <el-input
                v-model="row.value"
                :show-password="row.isSecret"
                placeholder="redis-cluster.internal:6379"
                size="small"
              />
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="220">
            <template #default="{ row }">
              <span class="desc-text">{{ row.description }}</span>
            </template>
          </el-table-column>
          <el-table-column label="" width="64" align="center">
            <template #default="{ $index }">
              <el-button type="danger" link size="small" :icon="Delete" @click="removeEnvItem($index)" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section v-else-if="activeTab === 'traffic'" class="tab-pane-view traffic-view">
      <div class="route-panel">
        <div class="route-head">
          <div>
            <div class="route-title">Ingress / {{ selectedService.name }}</div>
            <div class="route-sub">canary 权重写入后立即对 prod-east2 网关生效</div>
          </div>
          <el-button
            id="btn-apply-canary"
            type="primary"
            size="small"
            :disabled="trafficSlider === 0"
            @click="applyTrafficRule"
          >
            应用网关切流规则
          </el-button>
        </div>

        <div class="split-bars">
          <div class="split-col">
            <span class="split-label">stable · {{ selectedService.currentVersion }}</span>
            <div class="split-meter">
              <i :style="{ width: 100 - trafficSlider + '%' }" />
            </div>
            <strong>{{ 100 - trafficSlider }}%</strong>
          </div>
          <div class="split-col canary">
            <span class="split-label">canary · {{ deployVersion }}</span>
            <div class="split-meter">
              <i :style="{ width: trafficSlider + '%' }" />
            </div>
            <strong>{{ trafficSlider }}%</strong>
          </div>
        </div>

        <div class="slider-block">
          <div class="slider-info">
            <span>灰度流量切分权重</span>
            <b>{{ trafficSlider }}%</b>
          </div>
          <el-slider
            v-model="trafficSlider"
            :step="10"
            :marks="{ 0: '0%', 10: '10%', 50: '50%', 100: '100%' }"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.devops-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f6f7f9;
  color: #1f2329;
}

.cluster-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px;
  height: 40px;
  background: #1f2329;
  color: #d8dee6;
  font-size: 12px;
}

.crumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.crumb .sep {
  color: #6b7280;
}

.crumb-svc {
  color: #fff;
}

.cluster-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9aa3af;
}

.cluster-meta .dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #6b7280;
}

.status-chip {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #86efac;
  background: rgba(34, 197, 94, 0.16);
}

.status-chip.deploying {
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.18);
}

.status-chip.failed {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.18);
}

.weight {
  color: #e5e7eb;
}

.console-tabs {
  background: #fff;
  padding: 0 12px;
  border-bottom: 1px solid #e5e7eb;
}

.console-tabs :deep(.el-tabs__header) {
  margin: 0;
}

.console-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.console-tabs :deep(.el-tabs__item) {
  height: 40px;
  font-size: 13px;
}

.tab-pane-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: auto;
}

.catalog-toolbar,
.config-toolbar,
.deploy-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #eef0f3;
}

.ns-filters {
  display: flex;
  gap: 6px;
}

.ns-chip {
  height: 26px;
  padding: 0 10px;
  border: 1px solid #d9dee6;
  background: #fff;
  color: #4b5563;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
}

.ns-chip.active {
  border-color: #2563eb;
  color: #2563eb;
  background: #eff6ff;
}

.table-wrap {
  flex: 1;
  background: #fff;
}

.table-wrap :deep(.is-selected) {
  background: #f3f6fb;
}

.svc-name,
.code-font {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.ns-text {
  color: #6b7280;
  font-size: 12px;
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 6px;
  border-radius: 50%;
  background: #9ca3af;
}

.status-dot.healthy {
  background: #16a34a;
}

.status-dot.deploying {
  background: #2563eb;
}

.status-dot.failed {
  background: #dc2626;
}

.cpu-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.cpu-bar {
  display: block;
  width: 72px;
  height: 4px;
  background: #e5e7eb;
  overflow: hidden;
}

.cpu-bar i {
  display: block;
  height: 100%;
  background: #2563eb;
}

.deploy-toolbar {
  justify-content: flex-start;
}

.deploy-toolbar label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}

.running-ver {
  font-size: 12px;
  color: #6b7280;
}

.pipeline-view,
.traffic-view {
  background: #fff;
}

.pipeline-board {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 28px 24px 12px;
}

.pipe-stage {
  min-width: 140px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  background: #fafafa;
}

.pipe-stage.running {
  border-color: #2563eb;
  background: #eff6ff;
}

.pipe-stage.done {
  border-color: #86efac;
  background: #f0fdf4;
}

.pipe-stage.failed {
  border-color: #fca5a5;
  background: #fef2f2;
}

.pipe-name {
  font-size: 13px;
  font-weight: 600;
}

.pipe-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.pipe-arrow {
  color: #9ca3af;
}

.console-alert {
  display: flex;
  gap: 10px;
  margin: 16px 24px 24px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #e5e7eb;
}

.console-alert p {
  margin: 4px 0 0;
  color: #4b5563;
}

.console-alert.is-error {
  background: #fff7f7;
  border-color: #fecaca;
  color: #b91c1c;
}

.console-alert.is-ok {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #166534;
}

.text-link {
  padding: 0;
  border: none;
  background: none;
  color: #2563eb;
  cursor: pointer;
}

.terminal-view {
  background: #111318;
}

.pods-strip {
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.strip-title {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 12px;
  color: #6b7280;
}

.log-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.log-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #191c22;
  color: #9aa3af;
  font-size: 12px;
}

.log-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.term-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-console {
  flex: 1;
  min-height: 220px;
  overflow: auto;
  padding: 10px 14px;
  background: #111318;
  color: #d1d5db;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.65;
}

.console-row {
  word-break: break-all;
}

.console-row .ts {
  color: #6b7280;
  margin-right: 8px;
}

.console-row .lvl {
  margin-right: 8px;
  font-weight: 600;
}

.console-row .trace {
  color: #67e8f9;
  margin-right: 8px;
}

.level-info .lvl {
  color: #86efac;
}

.level-warn .lvl {
  color: #fbbf24;
}

.level-error {
  color: #fca5a5;
}

.level-error .lvl {
  color: #f87171;
}

.cfg-path {
  font-size: 13px;
  color: #6b7280;
}

.cfg-path span {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #111827;
}

.cfg-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.desc-text {
  font-size: 12px;
  color: #6b7280;
}

.route-panel {
  max-width: 760px;
  padding: 24px;
}

.route-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.route-title {
  font-size: 14px;
  font-weight: 600;
}

.route-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.split-bars {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 28px;
}

.split-col {
  padding: 14px;
  border: 1px solid #e5e7eb;
  background: #fafafa;
}

.split-col.canary {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.split-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 8px;
}

.split-meter {
  height: 8px;
  background: #e5e7eb;
  margin-bottom: 8px;
}

.split-meter i {
  display: block;
  height: 100%;
  background: #2563eb;
}

.split-col strong {
  font-size: 18px;
}

.slider-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
}

.text-danger {
  color: #dc2626;
  font-weight: 600;
}
</style>
