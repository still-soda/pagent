<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ArrowRight,
  Bell,
  Clock,
  Lock,
  MagicStick,
  Monitor,
} from '@element-plus/icons-vue'

/* ---------- 界面偏好 ---------- */
const language = ref('简体中文')
const languageOptions = ['简体中文', 'English', '日本語']

const theme = ref('浅色')
const themeOptions = ['浅色', '深色', '跟随系统']

const timezonePanelOpen = ref(false)
const timezone = ref('GMT+8 北京')
const timezoneOptions = [
  'GMT+8 北京',
  'GMT+9 东京',
  'GMT+5 伊斯兰堡',
  'GMT+1 巴黎',
  'GMT-4 纽约',
  'GMT-8 旧金山',
]

/* 顶级浮层：teleport 到 body，按触发按钮位置用 fixed + top/left 定位 */
type PopKind = 'language' | 'theme' | 'suggest'
const pop = reactive({ kind: '' as PopKind | '', x: 0, y: 0, width: 0 })

const popStyle = computed(() => ({
  left: `${pop.x}px`,
  top: `${pop.y}px`,
  minWidth: `${pop.width}px`,
}))

function positionPop(kind: PopKind, event: Event, toggle = true) {
  if (toggle && pop.kind === kind) {
    pop.kind = ''
    return
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  pop.kind = kind
  pop.x = Math.round(rect.left)
  pop.y = Math.round(rect.bottom + 6)
  pop.width = Math.round(rect.width)
}

function chooseLanguage(value: string) {
  language.value = value
  pop.kind = ''
}
function chooseTheme(value: string) {
  theme.value = value
  pop.kind = ''
}
function chooseTimezone(value: string) {
  timezone.value = value
  timezonePanelOpen.value = false
}

/* ---------- 通知偏好 ---------- */
const notifyPrefs = reactive({
  product: true,
  marketing: false,
  weekly: true,
})
const advancedOpen = ref(false)
const quietStart = ref('22:00')
const quietEnd = ref('08:00')
const digestDay = ref('每周五')

/* ---------- 安全设置 ---------- */
const verifyCode = '846203'
const countdown = ref(0)
const code = ref('')
const verifying = ref(false)
const verifyState = ref<'idle' | 'ok' | 'error'>('idle')
let countdownTimer: number | undefined

const verifyBanner = computed(() =>
  verifyState.value === 'ok' ? '安全令牌验证通过，本设备已受信任' : '验证码不正确，请重新输入',
)

function sendCode() {
  if (countdown.value > 0) return
  countdown.value = 5
  ElMessage.info(`验证码已发送：${verifyCode}`)
  countdownTimer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) window.clearInterval(countdownTimer)
  }, 1000)
}

function verify() {
  if (verifying.value || !code.value) return
  verifying.value = true
  window.setTimeout(() => {
    verifyState.value = code.value === verifyCode ? 'ok' : 'error'
    verifying.value = false
  }, 1200)
}

interface DeviceEntry {
  id: number
  name: string
  location: string
  time: string
  current: boolean
}
const devices = ref<DeviceEntry[]>([
  { id: 1, name: 'MacBook Air · Chrome 126', location: '上海', time: '当前会话', current: true },
  { id: 2, name: 'iPhone 15 · Safari', location: '上海', time: '2 小时前', current: false },
  { id: 3, name: 'Windows 11 · Edge', location: '北京', time: '昨天 21:40', current: false },
  { id: 4, name: 'iPad Air · Chrome', location: '杭州', time: '09-01 10:12', current: false },
])
function offline(id: number) {
  devices.value = devices.value.filter((device) => device.id !== id)
  ElMessage.success('设备已下线')
}

/* ---------- 功能实验室 ---------- */
const keyword = ref('')
const labFeatures = [
  '智能标签归档',
  '自动摘要',
  '多视图看板',
  '快捷指令面板',
  '批量导入模板',
  '语音输入',
]
const suggestions = computed(() => {
  const kw = keyword.value.trim()
  return kw ? labFeatures.filter((feature) => feature.includes(kw)) : labFeatures
})
function pickSuggestion(value: string) {
  keyword.value = value
  pop.kind = ''
}

const riskAgreed = ref(false)
const labEnabled = ref(false)

function enableLab() {
  labEnabled.value = true
  ElMessage.success('实验功能已开启')
}

/* ---------- 活动日志 ---------- */
interface LogEntry {
  time: string
  text: string
}
const logPool: LogEntry[] = [
  { time: '09-06 11:20', text: '更新了通知偏好' },
  { time: '09-06 10:05', text: '查看安全设置' },
  { time: '09-05 21:48', text: '在上海通过 iPhone 15 登录' },
  { time: '09-05 18:32', text: '修改了收货地址' },
  { time: '09-05 14:11', text: '导出了月度账单' },
  { time: '09-04 09:27', text: '开通了周报订阅' },
  { time: '09-03 22:15', text: '关闭了营销消息推送' },
  { time: '09-03 16:40', text: '更换了账号头像' },
  { time: '09-02 20:03', text: '绑定了新的手机号' },
  { time: '09-02 11:36', text: '在北京通过 Windows 设备登录' },
  { time: '09-01 19:50', text: '创建了快捷指令「日报」' },
  { time: '09-01 13:24', text: '调整了看板列宽' },
  { time: '08-31 10:09', text: '归档了 14 条过期任务' },
  { time: '08-30 17:45', text: '升级到专业版套餐' },
  { time: '08-30 08:58', text: '开启了双因素认证' },
  { time: '08-29 15:32', text: '邀请了 2 位协作者' },
  { time: '08-28 21:14', text: '在杭州通过 iPad 登录' },
  { time: '08-27 12:00', text: '清理了回收站' },
  { time: '08-26 09:41', text: '设置了静默时段 22:00 - 08:00' },
  { time: '08-25 19:26', text: '导出了联系人备份' },
  { time: '08-24 14:03', text: '更新了支付方式' },
  { time: '08-23 10:17', text: '收藏了 3 篇文档' },
  { time: '08-22 16:52', text: '调整了界面语言为简体中文' },
  { time: '08-21 11:08', text: '完成了新手引导' },
]
const PAGE_SIZE = 8
const logs = ref<LogEntry[]>(logPool.slice(0, PAGE_SIZE))
const logPage = ref(1)
const logLoadedAll = computed(() => logs.value.length >= logPool.length)
const logSentinel = ref<HTMLElement>()
let logObserver: IntersectionObserver | undefined

function loadMoreLogs() {
  if (logLoadedAll.value) return
  logPage.value += 1
  logs.value = logPool.slice(0, logPage.value * PAGE_SIZE)
}

onMounted(() => {
  logObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreLogs()
    },
    { rootMargin: '120px' },
  )
  if (logSentinel.value) logObserver.observe(logSentinel.value)
})

onBeforeUnmount(() => logObserver?.disconnect())

function savePreferences() {
  ElMessage.success('偏好已保存')
}
</script>

<template>
  <div class="preference-scene" data-scene="preferences">
    <el-card shadow="never" class="panel">
      <template #header>
        <div class="card-header">
          <span class="card-title"><el-icon><Monitor /></el-icon>界面偏好</span>
        </div>
      </template>

      <div class="pref-grid">
        <div class="pref-field">
          <span class="pref-label">语言</span>
          <button
            type="button"
            class="dropdown-trigger"
            :aria-expanded="pop.kind === 'language'"
            @click="positionPop('language', $event)"
          >
            <span>{{ language }}</span>
            <el-icon class="caret"><ArrowDown /></el-icon>
          </button>
        </div>

        <div class="pref-field">
          <span class="pref-label">主题</span>
          <button
            type="button"
            class="dropdown-trigger"
            :aria-expanded="pop.kind === 'theme'"
            @click="positionPop('theme', $event)"
          >
            <span>{{ theme }}</span>
            <el-icon class="caret"><ArrowDown /></el-icon>
          </button>
        </div>

        <div class="pref-field">
          <span class="pref-label">时区</span>
          <button
            type="button"
            class="dropdown-trigger wide"
            :aria-expanded="timezonePanelOpen"
            @click="timezonePanelOpen = !timezonePanelOpen"
          >
            <span>{{ timezone }}</span>
            <el-icon class="caret"><ArrowDown /></el-icon>
          </button>
        </div>
      </div>

      <div class="timezone-panel" :class="{ open: timezonePanelOpen }" role="listbox" aria-label="时区">
        <div class="timezone-list">
          <button
            v-for="option in timezoneOptions"
            :key="option"
            type="button"
            role="option"
            class="dropdown-option"
            :aria-selected="option === timezone"
            @click="chooseTimezone(option)"
          >
            {{ option }}
          </button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="panel">
      <template #header>
        <div class="card-header">
          <span class="card-title"><el-icon><Bell /></el-icon>通知偏好</span>
        </div>
      </template>

      <div class="switch-list">
        <label class="switch">
          <input v-model="notifyPrefs.product" type="checkbox" class="switch-input" />
          <span class="switch-track"></span>
          <span class="switch-text">
            <span class="switch-name">产品动态</span>
            <span class="switch-desc">版本更新与功能公告</span>
          </span>
        </label>
        <label class="switch">
          <input v-model="notifyPrefs.marketing" type="checkbox" class="switch-input" />
          <span class="switch-track"></span>
          <span class="switch-text">
            <span class="switch-name">营销活动</span>
            <span class="switch-desc">优惠信息与合作推广</span>
          </span>
        </label>
        <label class="switch">
          <input v-model="notifyPrefs.weekly" type="checkbox" class="switch-input" />
          <span class="switch-track"></span>
          <span class="switch-text">
            <span class="switch-name">每周摘要</span>
            <span class="switch-desc">每周五汇总当周动态</span>
          </span>
        </label>
      </div>

      <button type="button" class="advanced-toggle" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen">
        <span>高级规则</span>
        <el-icon class="caret" :class="{ flipped: advancedOpen }"><ArrowRight /></el-icon>
      </button>
      <div class="advanced-panel" :class="{ open: advancedOpen }">
        <div class="advanced-body">
          <div class="advanced-field">
            <span class="pref-label">静默时段</span>
            <div class="quiet-range">
              <input v-model="quietStart" type="time" class="time-input" aria-label="静默开始时间" />
              <span class="quiet-sep">至</span>
              <input v-model="quietEnd" type="time" class="time-input" aria-label="静默结束时间" />
            </div>
          </div>
          <div class="advanced-field">
            <span class="pref-label">摘要推送日</span>
            <div class="day-picker" role="radiogroup" aria-label="摘要推送日">
              <button
                v-for="day in ['每周一', '每周三', '每周五']"
                :key="day"
                type="button"
                class="day-option"
                :aria-checked="digestDay === day"
                :class="{ active: digestDay === day }"
                @click="digestDay = day"
              >
                {{ day }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="panel">
      <template #header>
        <div class="card-header">
          <span class="card-title"><el-icon><Lock /></el-icon>安全设置</span>
        </div>
      </template>

      <div class="verify-row">
        <button type="button" class="action-btn" :disabled="countdown > 0" @click="sendCode">
          {{ countdown > 0 ? `重新发送（${countdown}s）` : '发送验证码' }}
        </button>
        <input
          v-model="code"
          type="text"
          class="code-input"
          inputmode="numeric"
          maxlength="6"
          placeholder="6 位验证码"
          aria-label="验证码"
        />
        <button type="button" class="action-btn primary" :disabled="verifying || !code" @click="verify">
          {{ verifying ? '验证中…' : '验证' }}
        </button>
      </div>

      <div
        class="verify-banner"
        :class="{ show: verifyState !== 'idle', ok: verifyState === 'ok', error: verifyState === 'error' }"
        role="status"
      >
        {{ verifyState === 'idle' ? '' : verifyBanner }}
      </div>

      <div class="section-label">登录设备</div>
      <div class="device-list">
        <div v-for="device in devices" :key="device.id" class="device-row">
          <div class="device-info">
            <span class="device-name">{{ device.name }}</span>
            <span class="device-meta">{{ device.location }} · {{ device.time }}</span>
          </div>
          <el-tag v-if="device.current" size="small" type="success">本机</el-tag>
          <button v-else type="button" class="row-action" @click="offline(device.id)">下线</button>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="panel">
      <template #header>
        <div class="card-header">
          <span class="card-title"><el-icon><MagicStick /></el-icon>功能实验室</span>
        </div>
      </template>

      <div class="lab-search">
        <input
          v-model="keyword"
          type="text"
          class="lab-input"
          placeholder="搜索实验功能"
          aria-label="搜索实验功能"
          @focus="positionPop('suggest', $event, false)"
        />
      </div>

      <label class="switch">
        <input v-model="riskAgreed" type="checkbox" class="switch-input" />
        <span class="switch-track"></span>
        <span class="switch-text">
          <span class="switch-name">我已了解实验功能可能不稳定</span>
        </span>
      </label>

      <button type="button" class="action-btn primary" :disabled="!riskAgreed || labEnabled" @click="enableLab">
        {{ labEnabled ? '已开启' : '开启实验功能' }}
      </button>

      <div v-show="labEnabled" class="lab-panel">
        <div class="switch-list">
          <label class="switch">
            <input type="checkbox" class="switch-input" />
            <span class="switch-track"></span>
            <span class="switch-text"><span class="switch-name">自动摘要</span></span>
          </label>
          <label class="switch">
            <input type="checkbox" class="switch-input" />
            <span class="switch-track"></span>
            <span class="switch-text"><span class="switch-name">快捷指令面板</span></span>
          </label>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="panel">
      <template #header>
        <div class="card-header">
          <span class="card-title"><el-icon><Clock /></el-icon>活动日志</span>
        </div>
      </template>

      <ul class="log-list">
        <li v-for="(entry, index) in logs" :key="entry.time + entry.text" class="log-item">
          <span class="log-time">{{ entry.time }}</span>
          <span class="log-text">{{ entry.text }}</span>
          <span v-if="index === 0" class="log-dot"></span>
        </li>
      </ul>
      <div ref="logSentinel" class="log-sentinel">
        <span>{{ logLoadedAll ? '已加载全部' : '下拉加载更多…' }}</span>
      </div>
    </el-card>

    <div class="footer-actions">
      <button type="button" class="action-btn primary large" @click="savePreferences">保存偏好</button>
    </div>
  </div>

  <Teleport to="body">
    <div
      class="pop-layer language-pop"
      :class="{ open: pop.kind === 'language' }"
      :style="popStyle"
      role="listbox"
      aria-label="语言"
    >
      <button
        v-for="option in languageOptions"
        :key="option"
        type="button"
        role="option"
        class="dropdown-option"
        :aria-selected="option === language"
        @click="chooseLanguage(option)"
      >
        {{ option }}
      </button>
    </div>

    <div
      class="pop-layer theme-pop"
      :class="{ open: pop.kind === 'theme' }"
      :style="popStyle"
      role="listbox"
      aria-label="主题"
    >
      <button
        v-for="option in themeOptions"
        :key="option"
        type="button"
        role="option"
        class="dropdown-option"
        :aria-selected="option === theme"
        @click="chooseTheme(option)"
      >
        {{ option }}
      </button>
    </div>

    <div
      class="pop-layer suggest-pop"
      :class="{ open: pop.kind === 'suggest' }"
      :style="popStyle"
      role="listbox"
      aria-label="实验功能建议"
    >
      <button
        v-for="feature in suggestions"
        :key="feature"
        type="button"
        role="option"
        class="dropdown-option"
        @click="pickSuggestion(feature)"
      >
        {{ feature }}
      </button>
      <div v-if="!suggestions.length" class="suggest-empty">没有匹配的功能</div>
    </div>
  </Teleport>
</template>

<style scoped>
.preference-scene {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 860px;
  margin-inline: auto;
}

.panel {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

/* 通用下拉触发按钮 */
.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.dropdown-trigger:hover {
  border-color: var(--el-color-primary);
}

.dropdown-trigger.wide {
  width: 100%;
}

.caret {
  color: var(--el-text-color-secondary);
  transition: transform 0.2s;
}

.caret.flipped {
  transform: rotate(90deg);
}

/* 隐蔽点 1：opacity + pointer-events 隐藏的语言菜单，teleport 到 body 的顶级浮层，DOM 常驻 */
.pop-layer {
  position: fixed;
  z-index: 1800;
  padding: 6px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  box-shadow: var(--el-box-shadow-light);
}

.language-pop {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.language-pop.open {
  opacity: 1;
  pointer-events: auto;
}

/* 隐蔽点 2：visibility 隐藏的主题菜单，DOM 常驻 */
.theme-pop {
  visibility: hidden;
}

.theme-pop.open {
  visibility: visible;
}

.dropdown-option {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.dropdown-option:hover {
  background: var(--el-fill-color-light);
}

/* 隐蔽点 3：max-height 折叠的时区面板 */
.pref-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px 24px;
}

.pref-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pref-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.timezone-panel {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.25s ease;
}

.timezone-panel.open {
  max-height: 260px;
}

.timezone-list {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

/* 自定义开关：checkbox 本体透明，通过 label 点击 */
.switch-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  width: fit-content;
}

.switch-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
}

.switch-track {
  position: relative;
  flex: none;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--el-border-color);
  transition: background-color 0.2s;
}

.switch-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}

.switch-input:checked + .switch-track {
  background: var(--el-color-primary);
}

.switch-input:checked + .switch-track::after {
  transform: translateX(18px);
}

.switch-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.switch-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.switch-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 隐蔽点 4：max-height 折叠 + aria-expanded 的高级规则面板 */
.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
  padding: 0;
  border: none;
  background: none;
  color: var(--el-color-primary);
  font-size: 14px;
  cursor: pointer;
}

.advanced-panel {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.25s ease;
}

.advanced-panel.open {
  max-height: 180px;
}

.advanced-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0 4px;
}

.advanced-field {
  display: flex;
  align-items: center;
  gap: 16px;
}

.quiet-range {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.time-input {
  padding: 6px 10px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.day-picker {
  display: inline-flex;
  gap: 8px;
}

.day-option {
  padding: 6px 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 999px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 13px;
  cursor: pointer;
}

.day-option.active {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

/* 安全设置 */
.verify-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 16px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.2s, opacity 0.2s;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--el-color-primary);
}

.action-btn.primary {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
  color: #fff;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.large {
  padding: 10px 32px;
  font-size: 15px;
}

.code-input {
  width: 160px;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  font-size: 14px;
  letter-spacing: 2px;
  color: var(--el-text-color-primary);
}

.code-input:focus {
  outline: none;
  border-color: var(--el-color-primary);
}

/* 隐蔽点 5：opacity + translateY 隐藏的验证结果条，延迟淡入 */
.verify-banner {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  opacity: 0;
  transform: translateY(-8px);
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.verify-banner.show {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.verify-banner.ok {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.verify-banner.error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.section-label {
  margin: 22px 0 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  transition: background-color 0.15s;
}

.device-row:hover {
  background: var(--el-fill-color-light);
}

.device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.device-name {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.device-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 隐蔽点 6：hover 才出现的行内操作按钮 */
.row-action {
  padding: 4px 12px;
  border: 1px solid var(--el-color-danger-light-5);
  border-radius: 6px;
  background: transparent;
  color: var(--el-color-danger);
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.device-row:hover .row-action {
  opacity: 1;
  pointer-events: auto;
}

/* 功能实验室 */
.lab-search {
  margin-bottom: 18px;
}

.lab-input {
  width: 320px;
  padding: 8px 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.lab-input:focus {
  outline: none;
  border-color: var(--el-color-primary);
}

/* 隐蔽点 7：opacity + visibility 隐藏的搜索建议面板（顶级浮层） */
.suggest-pop {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.suggest-pop.open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.suggest-empty {
  padding: 10px 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.lab-panel {
  margin-top: 18px;
  padding: 16px;
  border-radius: 10px;
  background: var(--el-fill-color-light);
}

/* 活动日志 */
.log-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
}

.log-item {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 9px 4px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
  font-size: 13px;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  flex: none;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}

.log-text {
  color: var(--el-text-color-primary);
}

.log-dot {
  position: absolute;
  left: -2px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
}

.log-sentinel {
  padding: 18px 0 4px;
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.footer-actions {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
}
</style>
