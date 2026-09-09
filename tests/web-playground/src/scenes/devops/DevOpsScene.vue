<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
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
    case 'catalog': return '服务总览与指标'
    case 'pipeline': return '发布流水线'
    case 'terminal': return '实例与终端诊断'
    case 'config': return '环境配置中心'
    case 'traffic': return '网关与流量控制'
  }
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
async function startDeploy() {
  pipelineStatus.value = 'running'
  selectedService.value.status = 'deploying'
  currentStepIndex.value = 0
  appendLog('info', `Deploy pipeline triggered for [${selectedService.value.name}] target version: ${deployVersion.value}`)

  // 步骤 1: 源码编译拉取
  await new Promise((r) => setTimeout(r, 800))
  currentStepIndex.value = 1
  appendLog('info', 'Source checkout: commit 7f8d9b (feat: optimize settlement state machine). Build OK.')

  // 步骤 2: Docker 镜像构建
  await new Promise((r) => setTimeout(r, 900))
  currentStepIndex.value = 2
  appendLog('info', 'Image build: registry.xinglan.internal/prod-core/payment-service:v2.4.0 verified.')

  // 步骤 3: Kubernetes 调度
  await new Promise((r) => setTimeout(r, 1000))
  currentStepIndex.value = 3
  appendLog('info', 'Kubernetes Deployment rolling update started. 3 new pods provisioned.')

  // 步骤 4: 检查探针
  await new Promise((r) => setTimeout(r, 1100))

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
</script>

<template>
  <div class="devops-workbench">
    <!-- 顶部集群与微服务概览条 -->
    <header class="cluster-header">
      <div class="cluster-title-box">
        <div class="cluster-icon">
          <el-icon :size="20"><Monitor /></el-icon>
        </div>
        <div class="cluster-info">
          <h2>星澜微服务云原生控制台 · 华东生产主集群</h2>
          <span class="sub">ali-k8s-prod-east2 | Kubernetes v1.30.2 | 24 Nodes | 核心集群健康度 99.8%</span>
        </div>
      </div>

      <div class="cluster-quick-stats">
        <div class="quick-stat-item">
          <span class="k">微服务总数</span>
          <span class="v">{{ services.length }} 个</span>
        </div>
        <div class="quick-stat-item">
          <span class="k">正在操作微服务</span>
          <span class="v text-primary">{{ selectedService.name }} ({{ selectedService.currentVersion }})</span>
        </div>
        <div class="quick-stat-item">
          <span class="k">灰度切流权重</span>
          <span class="v text-success">{{ selectedService.trafficWeight }}%</span>
        </div>
      </div>
    </header>

    <!-- 业务职责多 Tab 导航 -->
    <div class="workbench-tabs-bar">
      <el-tabs v-model="activeTab" class="custom-tabs">
        <el-tab-pane label="服务总览与指标 (Catalog)" name="catalog" />
        <el-tab-pane label="版本发布流水线 (Pipeline)" name="pipeline" />
        <el-tab-pane label="实例与终端诊断 (Terminal)" name="terminal" />
        <el-tab-pane label="环境配置中心 (ConfigMap)" name="config" />
        <el-tab-pane label="网关与流量控制 (Traffic)" name="traffic" />
      </el-tabs>
    </div>

    <!-- Tab 1: 服务总览与指标 -->
    <section v-if="activeTab === 'catalog'" class="tab-pane-view">
      <div class="catalog-toolbar">
        <div class="toolbar-left">
          <span class="filter-lbl">命名空间：</span>
          <el-radio-group v-model="selectedNamespace" size="small">
            <el-radio-button label="all">全部 (16)</el-radio-button>
            <el-radio-button label="prod-core">prod-core 核心 (6)</el-radio-button>
            <el-radio-button label="prod-biz">prod-biz 业务 (7)</el-radio-button>
            <el-radio-button label="infra">infra 基建 (3)</el-radio-button>
          </el-radio-group>
        </div>
        <div class="toolbar-right">
          <el-input
            v-model="serviceSearch"
            placeholder="搜索微服务名称..."
            :prefix-icon="Search"
            clearable
            size="small"
            style="width: 240px"
          />
        </div>
      </div>

      <div class="service-table-box">
        <el-table :data="filteredServices" stripe border style="width: 100%">
          <el-table-column prop="name" label="微服务标识" min-width="180">
            <template #default="{ row }">
              <span class="svc-name" :class="{ 'svc-active': row.id === selectedServiceId }">
                {{ row.name }}
              </span>
              <el-tag v-if="row.id === selectedServiceId" size="small" type="primary" style="margin-left: 6px">
                当前选定
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="namespace" label="命名空间" width="120">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">{{ row.namespace }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="currentVersion" label="当前版本" width="110">
            <template #default="{ row }">
              <span class="code-font">{{ row.currentVersion }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="status" label="运行状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag
                :type="row.status === 'healthy' ? 'success' : row.status === 'deploying' ? 'primary' : 'danger'"
                size="small"
              >
                {{ row.status === 'healthy' ? '健康就绪' : row.status === 'deploying' ? '发布中' : '异常报警' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="replicas" label="Pod 副本" width="100" align="center">
            <template #default="{ row }">
              <span>{{ row.readyReplicas }} / {{ row.replicas }}</span>
            </template>
          </el-table-column>

          <el-table-column prop="cpuUsage" label="CPU 负荷" width="130">
            <template #default="{ row }">
              <el-progress :percentage="row.cpuUsage" :stroke-width="6" :show-text="false" />
              <span class="meter-text">{{ row.cpuUsage }}%</span>
            </template>
          </el-table-column>

          <el-table-column prop="trafficWeight" label="流量分配" width="110" align="center">
            <template #default="{ row }">
              <span class="code-font text-success">{{ row.trafficWeight }}%</span>
            </template>
          </el-table-column>

          <el-table-column prop="lastDeployed" label="最近部署时间" width="170" />

          <el-table-column label="管理操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                link
                size="small"
                @click="selectServiceAndGo(row, 'pipeline')"
              >
                发布流水线
              </el-button>
              <el-button
                type="info"
                link
                size="small"
                @click="selectServiceAndGo(row, 'config')"
              >
                配置中心
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <!-- Tab 2: 版本发布流水线 -->
    <section v-else-if="activeTab === 'pipeline'" class="tab-pane-view">
      <div class="pipeline-container">
        <div class="pipeline-card">
          <div class="card-title-row">
            <h3>微服务发布流水线 · {{ selectedService.name }}</h3>
            <span class="version-badge">当前运行：{{ selectedService.currentVersion }}</span>
          </div>

          <div class="pipeline-form-row">
            <div class="form-item">
              <label>目标服务：</label>
              <el-select v-model="selectedServiceId" style="width: 220px">
                <el-option
                  v-for="s in services"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-select>
            </div>

            <div class="form-item">
              <label>发布目标版本：</label>
              <el-select v-model="deployVersion" style="width: 220px">
                <el-option label="v2.4.0 (待灰度优化版本)" value="v2.4.0" />
                <el-option label="v2.4.1-rc1 (测试版)" value="v2.4.1-rc1" />
                <el-option label="v2.3.0 (回滚基础版本)" value="v2.3.0" />
              </el-select>
            </div>

            <div class="form-actions">
              <el-button
                id="btn-trigger-deploy"
                type="primary"
                :loading="pipelineStatus === 'running'"
                @click="startDeploy"
              >
                {{ pipelineStatus === 'failed' ? '重新执行发布' : '开始灰度发布' }}
              </el-button>
            </div>
          </div>

          <!-- 步骤条 -->
          <div class="stepper-box">
            <el-steps :active="currentStepIndex" finish-status="success" align-center>
              <el-step title="源码拉取与编译" description="Git commit 检出与构建" />
              <el-step title="安全与容器打包" description="CVE 扫描与 Docker Push" />
              <el-step title="Pod 滚动更新" description="K8s Deployment 调度" />
              <el-step
                title="存活与健康检查"
                :status="pipelineStatus === 'failed' ? 'error' : undefined"
                description="Liveness / Readiness 探针"
              />
            </el-steps>
          </div>

          <!-- 状态提示与排障向导 -->
          <div v-if="pipelineStatus === 'failed'" class="pipeline-alert-box alert-error">
            <div class="alert-icon">
              <el-icon :size="20"><WarningFilled /></el-icon>
            </div>
            <div class="alert-text">
              <h4>部署流水线中断：Pod 存活探针健康检查失败！</h4>
              <p>
                容器副本频繁崩溃重启 (CrashLoopBackOff)。请立即切换至
                <el-button type="danger" link @click="activeTab = 'terminal'">「实例与终端诊断」</el-button>
                查看崩溃报错日志，并在
                <el-button type="primary" link @click="activeTab = 'config'">「环境配置中心」</el-button>
                补全缺失的环境变量后重新部署。
              </p>
            </div>
          </div>

          <div v-else-if="pipelineStatus === 'success'" class="pipeline-alert-box alert-success">
            <div class="alert-icon">
              <el-icon :size="20"><Check /></el-icon>
            </div>
            <div class="alert-text">
              <h4>版本 {{ deployVersion }} 部署就绪！所有 Pod 健康检查通过 (3/3 Ready)</h4>
              <p>
                金丝雀部署验证成功。请前往
                <el-button type="success" link @click="activeTab = 'traffic'">「网关与流量控制」</el-button>
                将灰度切流权重提升至 100% 完成最终全量上线。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Tab 3: 实例与终端诊断 -->
    <section v-else-if="activeTab === 'terminal'" class="tab-pane-view">
      <div class="terminal-layout">
        <!-- 上部分：Pod 副本状态表 -->
        <div class="pods-card">
          <div class="card-title-row">
            <h3>{{ selectedService.name }} 容器副本集群列表 (Pods)</h3>
            <span class="sub-tip">健康副本数：{{ pods.filter(p => p.ready).length }}/{{ pods.length }}</span>
          </div>

          <el-table :data="pods" border size="small" style="width: 100%">
            <el-table-column prop="name" label="Pod 实例名称" min-width="220">
              <template #default="{ row }">
                <span class="code-font">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="140" align="center">
              <template #default="{ row }">
                <el-tag :type="row.ready ? 'success' : 'danger'" size="small">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="restarts" label="重启次数" width="90" align="center">
              <template #default="{ row }">
                <span :class="{ 'text-danger font-bold': row.restarts > 0 }">{{ row.restarts }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="ip" label="Pod IP" width="130" />
            <el-table-column prop="node" label="所在宿主机 Node" min-width="190" />
            <el-table-column prop="startTime" label="启动时间" width="160" />
          </el-table>
        </div>

        <!-- 下部分：排障黑底控制台终端 (CDP 抓取与文本检索点) -->
        <div class="terminal-card">
          <div class="terminal-topbar">
            <div class="term-title">
              <span>终端标准输出与错误日志 (stdout / stderr)</span>
              <el-tag size="small" type="info">实时链路抓取点</el-tag>
            </div>

            <div class="term-controls">
              <el-radio-group v-model="logFilterLevel" size="small">
                <el-radio-button label="all">全部</el-radio-button>
                <el-radio-button label="info">INFO</el-radio-button>
                <el-radio-button label="warn">WARN</el-radio-button>
                <el-radio-button label="error">ERROR</el-radio-button>
              </el-radio-group>
              <el-button size="small" :icon="RefreshRight" link @click="appendLog('info', 'Manual poll buffer sync OK')">
                刷新
              </el-button>
            </div>
          </div>

          <div class="terminal-console" id="k8s-log-terminal">
            <div
              v-for="(item, idx) in filteredLogs"
              :key="idx"
              class="console-row"
              :class="`level-${item.level}`"
            >
              <span class="ts">{{ item.timestamp }}</span>
              <span class="lvl">[{{ item.level.toUpperCase() }}]</span>
              <span class="trace">[{{ item.traceId }}]</span>
              <span class="log-msg">{{ item.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Tab 4: 环境配置中心 -->
    <section v-else-if="activeTab === 'config'" class="tab-pane-view">
      <div class="config-card">
        <div class="config-header">
          <div class="cfg-title">
            <h3>生产微服务环境配置中心 · ConfigMap & Secrets</h3>
            <span class="cfg-sub">包含 12+ 项生产级数据库、消息队列与微服务集群参数，支持在线编辑热加载</span>
          </div>
          <div class="cfg-actions">
            <el-input
              v-model="envSearch"
              placeholder="搜索配置键名 (如 REDIS)..."
              :prefix-icon="Search"
              size="small"
              clearable
              style="width: 240px"
            />
            <el-button type="primary" size="small" :icon="Plus" @click="addEnvItem">
              添加环境变量
            </el-button>
            <el-button id="btn-save-configs" type="success" size="small" @click="saveEnvConfigs">
              保存并热加载配置
            </el-button>
          </div>
        </div>

        <el-table :data="filteredEnvConfigs" border stripe style="width: 100%">
          <el-table-column prop="key" label="配置项键名 (KEY)" min-width="240">
            <template #default="{ row }">
              <el-input v-model="row.key" placeholder="如 REDIS_HOST" size="small" />
            </template>
          </el-table-column>

          <el-table-column prop="value" label="配置项值 (VALUE)" min-width="320">
            <template #default="{ row }">
              <el-input
                v-model="row.value"
                :show-password="row.isSecret"
                placeholder="输入环境变量值，如 redis-cluster.internal:6379"
                size="small"
              />
            </template>
          </el-table-column>

          <el-table-column prop="description" label="说明" min-width="200">
            <template #default="{ row }">
              <span class="desc-text">{{ row.description }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button
                type="danger"
                link
                size="small"
                :icon="Delete"
                @click="removeEnvItem($index)"
              />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <!-- Tab 5: 网关与流量控制 -->
    <section v-else-if="activeTab === 'traffic'" class="tab-pane-view">
      <div class="traffic-card">
        <div class="traffic-header">
          <h3>Ingress 网关金丝雀切流规则 (Canary Routing)</h3>
          <p class="traffic-desc">
            控制 {{ selectedService.name }} 生产环境流量分配。当所有 Pods 健康稳定后，将金丝雀流量由 10% 提升至 100% 完成全量放行。
          </p>
        </div>

        <div class="traffic-body">
          <div class="slider-wrapper">
            <div class="slider-info">
              <span class="lbl">灰度流量切分权重：</span>
              <span class="weight-display">{{ trafficSlider }}%</span>
            </div>
            <el-slider
              v-model="trafficSlider"
              :step="10"
              :marks="{ 0: '0%', 10: '10% (灰度)', 50: '50%', 100: '100% (全量发布)' }"
            />
          </div>

          <div class="traffic-action-box">
            <el-button
              id="btn-apply-canary"
              type="success"
              size="large"
              :disabled="trafficSlider === 0"
              @click="applyTrafficRule"
            >
              应用网关切流规则
            </el-button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.devops-workbench {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  height: calc(100vh - 120px);
  overflow-y: auto;
}

.cluster-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
}

.cluster-title-box {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cluster-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cluster-info h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.cluster-info .sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cluster-quick-stats {
  display: flex;
  gap: 20px;
}

.quick-stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: right;
}

.quick-stat-item .k {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.quick-stat-item .v {
  font-size: 14px;
  font-weight: 600;
}

.text-primary {
  color: var(--el-color-primary);
}
.text-success {
  color: var(--el-color-success);
}
.text-danger {
  color: var(--el-color-danger);
}

.workbench-tabs-bar {
  background: var(--el-bg-color);
  padding: 0 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.tab-pane-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Catalog 表格 */
.catalog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
}

.filter-lbl {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-right: 8px;
}

.service-table-box {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 14px;
}

.svc-name {
  font-family: monospace;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.svc-active {
  color: var(--el-color-primary);
}

.code-font {
  font-family: monospace;
  font-weight: 600;
}

.meter-text {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* Pipeline 流水线 */
.pipeline-card,
.pods-card,
.terminal-card,
.config-card,
.traffic-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 18px 20px;
}

.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title-row h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.version-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.pipeline-form-row {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 18px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 24px;
}

.form-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-item label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.stepper-box {
  padding: 24px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 20px;
}

.pipeline-alert-box {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 8px;
}

.alert-error {
  background: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-5);
  color: var(--el-color-danger);
}

.alert-success {
  background: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-5);
  color: var(--el-color-success);
}

.alert-text h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}

.alert-text p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

/* 终端 */
.terminal-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.terminal-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.term-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.term-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.terminal-console {
  background: #181818;
  color: #cccccc;
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  border-radius: 6px;
  padding: 12px 16px;
  height: 380px;
  overflow-y: auto;
}

.console-row {
  margin-bottom: 3px;
  word-break: break-all;
}

.console-row .ts {
  color: #777777;
  margin-right: 8px;
}

.console-row .lvl {
  font-weight: 600;
  margin-right: 8px;
}

.console-row .trace {
  color: #4ec9b0;
  margin-right: 8px;
}

.level-info .lvl {
  color: #4ec9b0;
}
.level-warn .lvl {
  color: #ce9178;
}
.level-error {
  color: #f48771;
}
.level-error .lvl {
  color: #f14c4c;
  font-weight: bold;
}

/* 配置中心 */
.config-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.cfg-title h3 {
  margin: 0 0 2px;
  font-size: 15px;
}

.cfg-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cfg-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.desc-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 流量控制 */
.traffic-header h3 {
  margin: 0 0 6px;
  font-size: 16px;
}

.traffic-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.traffic-body {
  margin-top: 24px;
  max-width: 600px;
}

.slider-wrapper {
  margin-bottom: 24px;
}

.slider-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.weight-display {
  font-size: 18px;
  font-weight: bold;
  color: var(--el-color-primary);
}
</style>
