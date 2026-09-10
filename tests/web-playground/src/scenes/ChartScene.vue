<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import Chart from 'chart.js/auto'
import type { Chart as ChartInstance } from 'chart.js'
import { useSceneOracle } from '../oracle'
import { verifyChart } from './chart-verify'

type Category = '数码' | '服饰' | '食品' | '家居'

interface Product {
  name: string
  category: Category
  price: number
}

const categoryList: Category[] = ['数码', '服饰', '食品', '家居']
const yearOptions = ['2023', '2024', '2025']
const channelOptions = ['线上商城', '直播带货', '线下门店', '分销代理']
const monthLabels = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]
const palette = [
  '#409eff', '#67c23a', '#e6a23c', '#f56c6c',
  '#9254de', '#36cfc9', '#ff85c0', '#ffc53d',
]

const products: Product[] = [
  { name: '无线降噪耳机', category: '数码', price: 899 },
  { name: '机械键盘', category: '数码', price: 499 },
  { name: '智能手表', category: '数码', price: 1299 },
  { name: '蓝牙音箱', category: '数码', price: 329 },
  { name: '轻薄羽绒服', category: '服饰', price: 699 },
  { name: '休闲运动鞋', category: '服饰', price: 459 },
  { name: '棒球帽', category: '服饰', price: 129 },
  { name: '手冲咖啡豆', category: '食品', price: 98 },
  { name: '坚果礼盒', category: '食品', price: 168 },
  { name: '冻干螺蛳粉', category: '食品', price: 39 },
  { name: '香薰助眠灯', category: '家居', price: 159 },
  { name: '桌面收纳盒', category: '家居', price: 69 },
  { name: '超声波加湿器', category: '家居', price: 199 },
]

const filters = reactive({
  year: '2025',
  category: '全部',
  channels: [...channelOptions],
  product: '',
})
const keyword = ref('')

const scopeSeed = computed(
  () =>
    `${filters.year}|${filters.category}|${filters.channels.join('+') || 'none'}|${filters.product || 'all'}`,
)

/** 确定性伪随机，保证相同筛选条件得到稳定数据 */
function rand(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

const visibleProducts = computed(() =>
  products.filter((p) => {
    if (filters.category !== '全部' && p.category !== filters.category) return false
    if (filters.product && p.name !== filters.product) return false
    const kw = keyword.value.trim()
    if (kw && !p.name.includes(kw)) return false
    return true
  }),
)

const monthly = computed(() => {
  const sales: number[] = []
  const orders: number[] = []
  const growth = 1 + 0.08 * (Number(filters.year) - 2023)
  const channelFactor = filters.channels.length / channelOptions.length
  for (let m = 1; m <= 12; m++) {
    const seasonal = 1 + 0.4 * Math.sin(((m - 3) / 12) * Math.PI * 2)
    const base = 86 * seasonal * growth * (0.35 + 0.65 * channelFactor)
    sales.push(Math.round(base * (0.8 + rand(`${scopeSeed.value}|sales|${m}`) * 0.4)))
    orders.push(Math.round(base * 9 * (0.8 + rand(`${scopeSeed.value}|orders|${m}`) * 0.4)))
  }
  return { sales, orders }
})

const shareCategories = computed(() =>
  filters.category === '全部'
    ? categoryList
    : categoryList.filter((c) => c === filters.category),
)

const categoryShare = computed(() =>
  shareCategories.value.map((c) => Math.round(80 + rand(`${scopeSeed.value}|cat|${c}`) * 920)),
)

const productRank = computed(() =>
  visibleProducts.value
    .map((p) => ({
      name: p.name,
      value: Math.round(p.price * (6 + rand(`${scopeSeed.value}|prod|${p.name}`) * 18)),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8),
)

const stats = computed(() => {
  const totalSales = monthly.value.sales.reduce((sum, v) => sum + v, 0)
  const totalOrders = monthly.value.orders.reduce((sum, v) => sum + v, 0)
  return {
    totalSales,
    totalOrders,
    avgOrder: totalOrders ? Math.round((totalSales * 10000) / totalOrders) : 0,
    productCount: visibleProducts.value.length,
  }
})

const trendCanvas = ref<HTMLCanvasElement>()
const shareCanvas = ref<HTMLCanvasElement>()
const rankCanvas = ref<HTMLCanvasElement>()

let trendChart: ChartInstance<'line'> | null = null
let shareChart: ChartInstance<'doughnut'> | null = null
let rankChart: ChartInstance<'bar'> | null = null

onMounted(() => {
  if (trendCanvas.value) {
    trendChart = new Chart(trendCanvas.value, {
      type: 'line',
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: '销售额（万元）',
            data: [],
            borderColor: '#409eff',
            backgroundColor: 'rgba(64, 158, 255, 0.12)',
            fill: true,
            tension: 0.35,
            yAxisID: 'y',
          },
          {
            label: '订单量（单）',
            data: [],
            borderColor: '#67c23a',
            backgroundColor: '#67c23a',
            tension: 0.35,
            borderDash: [6, 4],
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { position: 'left', title: { display: true, text: '万元' } },
          y1: {
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: '单' },
          },
        },
      },
    })
  }

  if (shareCanvas.value) {
    shareChart = new Chart(shareCanvas.value, {
      type: 'doughnut',
      data: {
        labels: shareCategories.value,
        datasets: [{ data: [], backgroundColor: palette, borderWidth: 2 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: { legend: { position: 'bottom' } },
      },
    })
  }

  if (rankCanvas.value) {
    rankChart = new Chart(rankCanvas.value, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: '销售额（万元）',
            data: [],
            backgroundColor: '#409eff',
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } } },
      },
    })
  }

  refreshCharts()
})

watch([monthly, categoryShare, shareCategories, productRank], refreshCharts)

onBeforeUnmount(() => {
  trendChart?.destroy()
  shareChart?.destroy()
  rankChart?.destroy()
  trendChart = null
  shareChart = null
  rankChart = null
})

function refreshCharts() {
  if (trendChart) {
    trendChart.data.datasets[0].data = monthly.value.sales
    trendChart.data.datasets[1].data = monthly.value.orders
    trendChart.update()
  }
  if (shareChart) {
    shareChart.data.labels = shareCategories.value
    shareChart.data.datasets[0].data = categoryShare.value
    shareChart.update()
  }
  if (rankChart) {
    rankChart.data.labels = productRank.value.map((item) => item.name)
    rankChart.data.datasets[0].data = productRank.value.map((item) => item.value)
    rankChart.update()
  }
}

function resetFilters() {
  filters.year = '2025'
  filters.category = '全部'
  filters.channels = [...channelOptions]
  filters.product = ''
  keyword.value = ''
}

useSceneOracle('chart', {
  verify: verifyChart,
  reset: resetFilters,
})
</script>

<template>
  <div class="chart-scene" data-scene="chart">
    <el-card shadow="never" class="panel-card">
      <template #header>
        <div class="card-header">
          <span>销售数据看板</span>
          <el-tag type="info" size="small">实时</el-tag>
        </div>
      </template>

      <div class="filters">
        <div class="filter-item">
          <label for="year">年度</label>
          <el-select id="year" v-model="filters.year" name="year" style="width: 120px">
            <el-option v-for="y in yearOptions" :key="y" :label="`${y} 年`" :value="y" />
          </el-select>
        </div>

        <div class="filter-item">
          <label for="category">品类</label>
          <el-select id="category" v-model="filters.category" name="category" style="width: 120px">
            <el-option v-for="c in ['全部', ...categoryList]" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <div class="filter-item">
          <label for="channels">渠道</label>
          <el-select
            id="channels"
            v-model="filters.channels"
            name="channels"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择渠道"
            style="width: 230px"
          >
            <el-option v-for="c in channelOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </div>

        <div class="filter-item">
          <label for="product">产品</label>
          <el-select
            id="product"
            v-model="filters.product"
            name="product"
            filterable
            clearable
            placeholder="搜索并选择产品"
            style="width: 200px"
          >
            <el-option v-for="p in products" :key="p.name" :label="p.name" :value="p.name" />
          </el-select>
        </div>

        <div class="filter-item">
          <label for="keyword">搜索</label>
          <el-input
            id="keyword"
            v-model="keyword"
            name="keyword"
            clearable
            :prefix-icon="Search"
            placeholder="按关键字过滤产品榜"
            style="width: 220px"
          />
        </div>

        <el-button native-type="button" @click="resetFilters">重置</el-button>
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="6">
        <el-card shadow="never" class="panel-card stat-card">
          <div class="stat-label">总销售额</div>
          <div class="stat-value">
            {{ stats.totalSales.toLocaleString() }}<span class="stat-unit">万元</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="panel-card stat-card">
          <div class="stat-label">总订单量</div>
          <div class="stat-value">
            {{ stats.totalOrders.toLocaleString() }}<span class="stat-unit">单</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="panel-card stat-card">
          <div class="stat-label">平均客单价</div>
          <div class="stat-value">
            {{ stats.avgOrder.toLocaleString() }}<span class="stat-unit">元</span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never" class="panel-card stat-card">
          <div class="stat-label">在售产品</div>
          <div class="stat-value">
            {{ stats.productCount }}<span class="stat-unit">件</span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="panel-card">
      <template #header>
        <span>月度销售趋势</span>
      </template>
      <div class="chart-box">
        <canvas ref="trendCanvas" />
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <span>品类销售占比</span>
          </template>
          <div class="chart-box">
            <canvas ref="shareCanvas" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="never" class="panel-card">
          <template #header>
            <span>产品销售榜</span>
          </template>
          <div class="chart-box">
            <canvas ref="rankCanvas" />
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.chart-scene {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1080px;
  margin-inline: auto;
}

.panel-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-item label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.stat-card :deep(.el-card__body) {
  padding: 16px 20px;
}

.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-unit {
  margin-left: 4px;
  font-size: 13px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.chart-box {
  position: relative;
  height: 280px;
}
</style>
