<template>
  <div class="charts-row">
    <!-- Card 1: Forecast Variance -->
    <div class="chart-card">
      <div class="chart-card-header">
        <div class="chart-card-titles">
          <div class="title-with-icon">
            <Icon name="heroicons:chart-bar-20-solid" class="card-title-icon" />
            <h3 class="card-chart-title">Forecast Variance</h3>
          </div>
          <span class="card-chart-subtitle">Visualization of the Forecast with Deviations marked. Hover for details.</span>
        </div>
        <div class="card-header-right">
          <Icon
            :name="store.summaryFindings.percentageDeviationTotal >= 0 ? 'heroicons:arrow-trending-up-20-solid' : 'heroicons:arrow-trending-down-20-solid'"
            :class="store.summaryFindings.percentageDeviationTotal >= 0 ? 'trend-up-icon' : 'trend-down-icon'"
          />
          <span class="trend-value" :class="store.summaryFindings.percentageDeviationTotal >= 0 ? 'trend-up-text' : 'trend-down-text'">
            {{ store.summaryFindings.percentageDeviationTotal >= 0 ? '+' : '' }}{{ store.summaryFindings.percentageDeviationTotal }}%
          </span>
        </div>
      </div>
      <div class="chart-wrapper">
        <component :is="VChart" v-if="VChart" :option="chartOption1" class="echart-instance" />
        <div v-else class="chart-loading">Loading chart…</div>
      </div>
    </div>

    <!-- Card 2: Waterfall: Deviations -->
    <div class="chart-card">
      <div class="chart-card-header">
        <div class="chart-card-titles">
          <div class="title-with-icon">
            <Icon name="heroicons:presentation-chart-bar-20-solid" class="card-title-icon" />
            <h3 class="card-chart-title">Waterfall: Deviations</h3>
          </div>
          <span class="card-chart-subtitle">Waterfall Chart on the Variations. Hover for details.</span>
        </div>
      </div>
      <div class="chart-wrapper">
        <component :is="VChart" v-if="VChart" :option="chartOption2" class="echart-instance" />
        <div v-else class="chart-loading">Loading chart…</div>
      </div>
      <div class="waterfall-legend">
        <div class="legend-item"><span class="color-box base-box"></span><span>Base</span></div>
        <div class="legend-item"><span class="color-box increase-box"></span><span>Increase</span></div>
        <div class="legend-item"><span class="color-box decrease-box"></span><span>Decrease</span></div>
        <div class="legend-item"><span class="color-box forecast-box"></span><span>Forecast</span></div>
      </div>
    </div>

    <!-- Card 3: Pie Chart on Deviations (narrower — compact pie) -->
    <div class="chart-card pie-chart-card">
      <div class="chart-card-header">
        <div class="chart-card-titles">
          <div class="title-with-icon">
            <Icon name="heroicons:chart-pie-20-solid" class="card-title-icon" />
            <h3 class="card-chart-title">Pie Chart on Deviations</h3>
          </div>
          <span class="card-chart-subtitle">Proportional contribution of each cost category to the total forecasted cost.</span>
        </div>
      </div>
      <div class="chart-wrapper">
        <component :is="VChart" v-if="VChart" :option="chartOption3" class="echart-instance" />
        <div v-else class="chart-loading">Loading chart…</div>
      </div>
      <div class="pie-legend">
        <div v-for="item in pieLegendItems" :key="item.label" class="legend-item">
          <span class="color-box" :style="{ backgroundColor: item.color }"></span>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, onMounted } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

const store = useVedaStore()

// ── Lazy-load ECharts (client only) ──────────────────────────────────────
const VChart = shallowRef<any>(null)

onMounted(async () => {
  if (!process.client) return
  try {
    // vue-echarts v6 requires explicit registration of chart types + components
    const echarts = await import('echarts/core')
    const { BarChart, PieChart } = await import('echarts/charts')
    const {
      GridComponent,
      TooltipComponent,
      LegendComponent,
    } = await import('echarts/components')
    const { CanvasRenderer } = await import('echarts/renderers')

    echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

    const { default: vc } = await import('vue-echarts')
    VChart.value = vc
  } catch (err) {
    console.error('Failed to load ECharts:', err)
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────
const fmt = (val: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val)

const getAbbreviation = (costType: string) => {
  const t = costType.toLowerCase()
  if (t.includes('pipeline')) return 'PL'
  if (t.includes('facility') || t.includes('facilities') || t.includes('production')) return 'PF'
  if (t.includes('deck') || (t.includes('structure') && !t.includes('sub'))) return 'DS'
  if (t.includes('substructure') || t.includes('sub-structure')) return 'SUB'
  if (t.includes('certif') || t.includes('permit')) return 'C&F'
  if (t.includes('support') || t.includes('general')) return 'GS'
  return 'OTHER'
}

type CatKey = 'PL' | 'PF' | 'DS' | 'SUB' | 'C&F' | 'GS'
const emptyRow = () => ({ baseline: 0, forecast: 0, variance: 0 })

const getCategoryData = () => {
  const result: Record<CatKey, { baseline: number; forecast: number; variance: number }> = {
    PL: emptyRow(), PF: emptyRow(), DS: emptyRow(),
    SUB: emptyRow(), 'C&F': emptyRow(), GS: emptyRow(),
  }
  store.componentFindings.forEach(f => {
    const abb = getAbbreviation(f.costType) as CatKey
    if (abb in result) {
      result[abb] = { baseline: f.baseline, forecast: f.forecast, variance: f.absoluteVariance }
    }
  })
  return result
}

// ── Chart 1: Stacked Bar ─────────────────────────────────────────────────
const chartOption1 = computed(() => {
  const data = getCategoryData()
  const cats: CatKey[] = ['PL', 'PF', 'DS', 'SUB', 'C&F', 'GS']
  const baselineData = cats.map(c => data[c].baseline)
  const deviationData = cats.map(c => data[c].variance)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const base = params[0].value, dev = params[1].value
        return `
          <div style="font-family:var(--font-family);font-size:11px;padding:4px;line-height:1.5;">
            <strong style="color:#0f172a;font-size:12px;margin-bottom:4px;display:inline-block;">Category: ${params[0].name}</strong><br/>
            <span style="color:#64748b;">Baseline:</span> $${fmt(base)}<br/>
            <span style="color:#64748b;">Deviation:</span> $${fmt(dev)}<br/>
            <strong style="color:#D85A30;">Forecast:</strong> $${fmt(base + dev)}
          </div>`
      },
    },
    legend: { show: false },
    grid: { top: '10%', left: '3%', right: '3%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'category', data: cats,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#64748b', fontWeight: 600, fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
      axisLabel: {
        color: '#64748b', fontWeight: 600, fontSize: 10,
        formatter: (v: number) => v >= 1_000_000 ? (v / 1_000_000).toFixed(0) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v,
      },
    },
    series: [
      { name: 'Baseline',  type: 'bar', stack: 'total', barWidth: '55%', itemStyle: { color: '#D85A30' }, data: baselineData },
      { name: 'Deviation', type: 'bar', stack: 'total', barWidth: '55%', itemStyle: { color: '#a3c96c' }, data: deviationData },
    ],
  }
})

// ── Chart 2: Waterfall ───────────────────────────────────────────────────
const getWaterfallData = () => {
  const data = getCategoryData()
  const cats: CatKey[] = ['PL', 'PF', 'DS', 'SUB', 'C&F', 'GS']
  const names = ['Base', ...cats, 'Forecast']
  const baseVal = store.summaryFindings.baselineTotal
  const forecastVal = store.summaryFindings.forecastTotal
  const minY = Math.floor(Math.min(baseVal, forecastVal) / 1_000_000 - 1) * 1_000_000

  const placeholder: number[] = [minY]
  const visibleData: any[] = [{ value: baseVal - minY, itemStyle: { color: '#fb923c' } }]

  let running = baseVal
  cats.forEach(cat => {
    const dev = data[cat].variance
    const prev = running
    running += dev
    if (dev >= 0) {
      placeholder.push(prev)
      visibleData.push({ value: dev, itemStyle: { color: '#ef4444' } })
    } else {
      placeholder.push(running)
      visibleData.push({ value: Math.abs(dev), itemStyle: { color: '#a3c96c' } })
    }
  })

  placeholder.push(minY)
  visibleData.push({ value: forecastVal - minY, itemStyle: { color: '#fca5a5' } })
  return { names, placeholder, visibleData, minY }
}

const chartOption2 = computed(() => {
  const wf = getWaterfallData()
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const name = params[0].name
        const base = wf.placeholder[params[0].dataIndex]
        const heightVal = params[1].value
        if (name === 'Base') return `<strong style="color:#fb923c;">Base:</strong> $${fmt(base + heightVal)}`
        if (name === 'Forecast') return `<strong style="color:#fca5a5;">Forecast:</strong> $${fmt(base + heightVal)}`
        const dev = getCategoryData()[name as CatKey]?.variance ?? 0
        const sign = dev >= 0 ? '+' : ''
        const col = dev >= 0 ? '#ef4444' : '#a3c96c'
        return `<div style="font-family:var(--font-family);font-size:11px;padding:4px;line-height:1.5;"><strong style="color:#0f172a;font-size:12px;display:inline-block;">Category: ${name}</strong><br/><span style="color:#64748b;">Deviation:</span> <span style="color:${col};font-weight:700;">${sign}$${fmt(dev)}</span></div>`
      },
    },
    grid: { top: '10%', left: '3%', right: '3%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'category', data: wf.names,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#64748b', fontWeight: 600, fontSize: 10 },
    },
    yAxis: {
      type: 'value', min: wf.minY,
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
      axisLabel: {
        color: '#64748b', fontWeight: 600, fontSize: 10,
        formatter: (v: number) => v >= 1_000_000 ? (v / 1_000_000).toFixed(0) + 'M' : v,
      },
    },
    series: [
      {
        name: 'Placeholder', type: 'bar', stack: 'all',
        itemStyle: { borderColor: 'transparent', color: 'transparent' },
        emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
        data: wf.placeholder,
      },
      { name: 'Value', type: 'bar', stack: 'all', barWidth: '60%', itemStyle: { borderRadius: 3 }, data: wf.visibleData },
    ],
  }
})

// ── Chart 3: Pie ─────────────────────────────────────────────────────────
const chartOption3 = computed(() => {
  const data = getCategoryData()
  const pieData = [
    { name: 'Pipeline',                  value: data['PL'].forecast,  itemStyle: { color: '#D85A30' } },
    { name: 'Production Facilities',     value: data['PF'].forecast,  itemStyle: { color: '#a3c96c' } },
    { name: 'Deck Structure',            value: data['DS'].forecast,  itemStyle: { color: '#3f6212' } },
    { name: 'Substructure',              value: data['SUB'].forecast, itemStyle: { color: '#fca5a5' } },
    { name: 'Certifications and Permits',value: data['C&F'].forecast, itemStyle: { color: '#f97316' } },
    { name: 'General Support',           value: data['GS'].forecast,  itemStyle: { color: '#fb923c' } },
  ]
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) =>
        `<div style="font-family:var(--font-family);font-size:11px;padding:4px;line-height:1.5;"><strong style="color:#0f172a;font-size:12px;display:inline-block;">${params.name}</strong><br/>Forecast: $${fmt(params.value)}<br/>Proportion: <strong>${params.percent}%</strong></div>`,
    },
    series: [{
      type: 'pie', radius: '75%', center: ['50%', '50%'],
      avoidLabelOverlap: false,
      label: { show: false }, labelLine: { show: false },
      itemStyle: { borderColor: '#ffffff', borderWidth: 1.5 },
      data: pieData,
    }],
  }
})

const pieLegendItems = [
  { label: 'Substruct.', color: '#fca5a5' },
  { label: 'Pipeline',   color: '#D85A30' },
  { label: 'Product.',   color: '#a3c96c' },
  { label: 'C&F',        color: '#f97316' },
  { label: 'Dec Str.',   color: '#3f6212' },
  { label: 'General Sup.', color: '#fb923c' },
]
</script>

<style scoped>
.charts-row {
  display: flex;
  flex-direction: row;
  gap: 16px;
  width: 100%;
}

.chart-card {
  flex: 1;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

/* Pie is compact — no need for the same width as bar charts */
.pie-chart-card {
  flex: 0 0 220px;
  width: 220px;
}

.chart-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.chart-card-titles { display: flex; flex-direction: column; gap: 3px; }

.title-with-icon { display: flex; align-items: center; gap: 6px; }

.card-title-icon {
  width: 16px; height: 16px;
  color: #D85A30;
  flex-shrink: 0;
}

.card-chart-title { font-size: 13px; font-weight: 700; color: #0f172a; }
.card-chart-subtitle { font-size: 11px; color: #94a3b8; line-height: 1.4; }

.card-header-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.trend-up-icon   { width: 16px; height: 16px; color: #a3c96c; }
.trend-down-icon { width: 16px; height: 16px; color: #ef4444; }
.trend-value     { font-size: 12px; font-weight: 700; }
.trend-up-text   { color: #a3c96c; }
.trend-down-text { color: #ef4444; }

.chart-wrapper { width: 100%; flex: 1; }
.echart-instance { width: 100%; height: 220px; }
.chart-loading { height: 220px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; }

/* Legends */
.waterfall-legend,
.pie-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #64748b; font-weight: 500; }
.color-box   { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.base-box     { background: #fb923c; }
.increase-box { background: #ef4444; }
.decrease-box { background: #a3c96c; }
.forecast-box { background: #fca5a5; }
</style>
