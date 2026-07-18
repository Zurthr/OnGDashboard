<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">Dashboard</h1>
    </div>


    <!-- No-data state -->
    <div v-if="!store.hasData" class="empty-state-card">
      <Icon name="heroicons:chart-bar" class="empty-ic" />
      <p class="empty-title">No data to visualize</p>
      <p class="empty-hint">
        Go to the <NuxtLink to="/extract" class="inline-link">Extraction</NuxtLink> page and use
        <strong>Import to Repository</strong> after processing your documents.
      </p>
    </div>

    <template v-else>
      <!-- Tab bar -->
      <div class="tab-bar-row">
        <div class="tab-buttons">
          <button
            v-for="tab in tabs"
            :key="tab"
            class="tab-btn"
            :class="{ 'active-tab': activeTab === tab }"
            @click="activeTab = tab"
          >
            {{ tab }}
          </button>
        </div>
      </div>

      <!-- Tab content (no page scroll — each tab is a self-contained view) -->
      <Transition name="tab-fade" mode="out-in">
        <!-- Tab 1: Basic -->
        <div v-if="activeTab === 'Basic'" key="basic" class="tab-panel">
          <div class="scorecard-row">
            <div class="sc-card">
              <span class="sc-label">Total AFEs</span>
              <span class="sc-val num-font">{{ store.totalRecords }}</span>
            </div>
            <div class="sc-card">
              <span class="sc-label">Avg Water Depth</span>
              <span class="sc-val num-font">{{ store.avgWaterDepth }}</span>
            </div>
            <div class="sc-card">
              <span class="sc-label">Data Completeness</span>
              <span class="sc-val num-font">{{ overallCompleteness }}%</span>
            </div>
            <div class="sc-card" :class="{ 'warn-card': store.dlqCount > 0 }">
              <span class="sc-label">DLQ Flags</span>
              <span class="sc-val num-font">{{ store.dlqCount }}</span>
            </div>
          </div>
        </div>

        <!-- Tab 2: Water Depth, Legs & Slots -->
        <div v-else-if="activeTab === 'Water Depth, Legs & Slots'" key="wls" class="tab-panel">
          <div class="charts-grid charts-grid--3col">
            <section class="card chart-card">
              <h3 class="chart-title">Water Depth Distribution</h3>
              <p class="chart-sub">Histogram of water depth (meters)</p>
              <div class="chart-wrap"><VChart :option="waterDepthChart" autoresize style="height:260px" /></div>
            </section>
            <section class="card chart-card">
              <h3 class="chart-title">Platforms by Number of Legs</h3>
              <p class="chart-sub">Count per leg configuration</p>
              <div class="chart-wrap"><VChart :option="legsChart" autoresize style="height:260px" /></div>
            </section>
            <section class="card chart-card">
              <h3 class="chart-title">Platforms by Number of Slots</h3>
              <p class="chart-sub">Well-slot capacity distribution</p>
              <div class="chart-wrap"><VChart :option="slotsChart" autoresize style="height:260px" /></div>
            </section>
          </div>
        </div>

        <!-- Tab 3: Weight Distribution -->
        <div v-else-if="activeTab === 'Weight Distribution'" key="weights" class="tab-panel">
          <div class="charts-grid charts-grid--3col">
            <section class="card chart-card">
              <h3 class="chart-title">Topside Weight</h3>
              <p class="chart-sub">Distribution across projects (MT)</p>
              <div class="chart-wrap"><VChart :option="topsideWeightChart" autoresize style="height:260px" /></div>
            </section>
            <section class="card chart-card">
              <h3 class="chart-title">Jacket Weight</h3>
              <p class="chart-sub">Distribution across projects (MT)</p>
              <div class="chart-wrap"><VChart :option="jacketWeightChart" autoresize style="height:260px" /></div>
            </section>
            <section class="card chart-card">
              <h3 class="chart-title">Piling Weight</h3>
              <p class="chart-sub">Distribution across projects (MT)</p>
              <div class="chart-wrap"><VChart :option="pilingWeightChart" autoresize style="height:260px" /></div>
            </section>
          </div>
        </div>

        <!-- Tab 4: Other -->
        <div v-else key="other" class="tab-panel">
          <div class="charts-grid charts-grid--2col">
            <section class="card chart-card">
              <h3 class="chart-title">Impurity Levels</h3>
              <p class="chart-sub">H₂S, CO₂, and Hg (numeric records only)</p>
              <div class="chart-wrap"><VChart :option="impurityChart" autoresize style="height:280px" /></div>
            </section>
            <section class="card chart-card">
              <h3 class="chart-title">Data Completeness per Parameter</h3>
              <p class="chart-sub">Found vs missing per parameter</p>
              <div class="chart-wrap"><VChart :option="completenessChart" autoresize style="height:280px" /></div>
            </section>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useAfeStore } from '~/stores/afeStore'

use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
useHead({ title: 'SKK Migas — AFE Dashboard' })

const store = useAfeStore()

onMounted(() => {
  store.fetchAll()
})

/* ── Tabs ─────────────────────────────────────────────── */
const tabs = ['Basic', 'Water Depth, Legs & Slots', 'Weight Distribution', 'Other'] as const
const activeTab = ref<typeof tabs[number]>('Basic')

/* ── Color palette ────────────────────────────────────── */
const C = {
  primary: '#ef4444',
  secondary: '#fb923c',
  tertiary: '#fbbf24',
  green: '#10b981',
  muted: '#e2e8f0',
  text: '#0f172a',
  sub: '#64748b',
  grid: '#f1f5f9',
}

/* ── Helpers (keys match afe_records DB columns) ─────── */
const paramKeys = ['water_depth', 'weight_topside', 'weight_jacket', 'piling_weight', 'number_of_legs', 'number_of_slots', 'impurities_h2s', 'impurities_co2', 'impurities_hg']
const paramLabels: Record<string, string> = {
  water_depth: 'Water Depth', weight_topside: 'Topside Wt', weight_jacket: 'Jacket Wt',
  piling_weight: 'Piling Wt', number_of_legs: 'Legs', number_of_slots: 'Slots',
  impurities_h2s: 'H₂S', impurities_co2: 'CO₂', impurities_hg: 'Hg',
}

const overallCompleteness = computed(() => {
  const total = store.totalRecords * paramKeys.length
  const found = paramKeys.reduce((acc, k) => acc + store.numericValues(k).length, 0)
  const textKeys = ['topside_equipment_wellhead', 'topside_equipment_processing', 'topside_equipment_utilities']
  const textFound = textKeys.reduce((acc, k) => acc + store.rows.filter(r => r[k] != null && r[k] !== '').length, 0)
  const adjTotal = total + store.totalRecords * textKeys.length
  return adjTotal ? Math.round(((found + textFound) / adjTotal) * 100) : 0
})

/* ── Shared chart config ─────────────────────────────── */
const baseGrid = { left: 48, right: 24, top: 24, bottom: 32 }
const tip = { backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: C.text, fontFamily: 'Inter', fontSize: 12 } }
const axisLabel = { fontFamily: 'Inter', fontSize: 11, color: C.sub }
const splitLine = { lineStyle: { color: C.grid } }

/* ── Generic histogram builder (used for water depth + each weight type) ── */
function makeHistogram(values: number[], bins: number[], color: string) {
  const labels = bins.slice(0, -1).map((b, i) => `${b}–${bins[i + 1]}`)
  const counts = labels.map((_, i) => values.filter(v => v >= bins[i] && v < bins[i + 1]).length)
  return {
    grid: baseGrid, tooltip: { ...tip, trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: labels, axisLabel },
    yAxis: { type: 'value' as const, splitLine, axisLabel },
    series: [{ type: 'bar' as const, data: counts, barWidth: '60%', itemStyle: { color, borderRadius: [6, 6, 0, 0] } }],
  }
}

/* ── Water Depth Histogram ───────────────────────────── */
const waterDepthChart = computed(() =>
  makeHistogram(store.numericValues('water_depth'), [0, 30, 60, 90, 120, 150, 200], C.primary)
)

/* ── Weight Distribution — three SEPARATE histograms ─── */
const topsideWeightChart = computed(() =>
  makeHistogram(store.numericValues('weight_topside'), [0, 500, 1000, 1500, 2000, 2500, 3000], C.primary)
)
const jacketWeightChart = computed(() =>
  makeHistogram(store.numericValues('weight_jacket'), [0, 1000, 2000, 3000, 4000, 5000, 6000], C.secondary)
)
const pilingWeightChart = computed(() =>
  makeHistogram(store.numericValues('piling_weight'), [0, 400, 800, 1200, 1600, 2000, 2400], C.tertiary)
)

/* ── Legs count bar ──────────────────────────────────── */
const legsChart = computed(() => {
  const vals = store.numericValues('number_of_legs')
  const unique = [...new Set(vals)].sort((a, b) => a - b)
  return {
    grid: baseGrid, tooltip: { ...tip, trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: unique.map(v => v + '-leg'), axisLabel },
    yAxis: { type: 'value' as const, minInterval: 1, splitLine, axisLabel },
    series: [{ type: 'bar' as const, data: unique.map(u => vals.filter(v => v === u).length), barWidth: '50%', itemStyle: { color: C.secondary, borderRadius: [6, 6, 0, 0] } }],
  }
})

/* ── Slots count bar ─────────────────────────────────── */
const slotsChart = computed(() => {
  const vals = store.numericValues('number_of_slots')
  const unique = [...new Set(vals)].sort((a, b) => a - b)
  return {
    grid: baseGrid, tooltip: { ...tip, trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: unique.map(String), axisLabel },
    yAxis: { type: 'value' as const, minInterval: 1, splitLine, axisLabel },
    series: [{ type: 'bar' as const, data: unique.map(u => vals.filter(v => v === u).length), barWidth: '50%', itemStyle: { color: C.tertiary, borderRadius: [6, 6, 0, 0] } }],
  }
})

/* ── Impurity grouped bar ────────────────────────────── */
const impurityChart = computed(() => {
  const rows = store.rows.filter(r =>
    typeof r.impurities_h2s === 'number' || typeof r.impurities_co2 === 'number' || typeof r.impurities_hg === 'number'
  )
  const labels = rows.map(r => (r.afe_number || '?') as string)
  return {
    grid: { ...baseGrid, bottom: 48 }, tooltip: { ...tip, trigger: 'axis' as const },
    legend: { bottom: 0, textStyle: { fontFamily: 'Inter', fontSize: 11, color: C.sub } },
    xAxis: { type: 'category' as const, data: labels, axisLabel },
    yAxis: { type: 'value' as const, splitLine, axisLabel },
    series: [
      { type: 'bar' as const, name: 'H₂S', data: rows.map(r => (typeof r.impurities_h2s === 'number' ? r.impurities_h2s : 0) as number), itemStyle: { color: C.primary, borderRadius: [4, 4, 0, 0] } },
      { type: 'bar' as const, name: 'CO₂', data: rows.map(r => (typeof r.impurities_co2 === 'number' ? r.impurities_co2 : 0) as number), itemStyle: { color: C.secondary, borderRadius: [4, 4, 0, 0] } },
      { type: 'bar' as const, name: 'Hg', data: rows.map(r => (typeof r.impurities_hg === 'number' ? r.impurities_hg : 0) as number), itemStyle: { color: C.tertiary, borderRadius: [4, 4, 0, 0] } },
    ],
  }
})

/* ── Completeness horizontal bar ─────────────────────── */
const completenessChart = computed(() => {
  const allKeys = [...paramKeys, 'topside_equipment_wellhead', 'topside_equipment_processing', 'topside_equipment_utilities']
  const labels = allKeys.map(k => paramLabels[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
  const total = store.totalRecords
  const found = allKeys.map(k => store.rows.filter(r => r[k] != null && r[k] !== '').length)
  const missing = found.map(f => total - f)
  return {
    grid: { left: 130, right: 24, top: 16, bottom: 24 }, tooltip: { ...tip, trigger: 'axis' as const },
    legend: { show: false },
    yAxis: { type: 'category' as const, data: labels, axisLabel, inverse: true },
    xAxis: { type: 'value' as const, max: total, splitLine, axisLabel },
    series: [
      { type: 'bar' as const, name: 'Found', stack: 'a', data: found, itemStyle: { color: C.green }, barWidth: '55%' },
      { type: 'bar' as const, name: 'Missing', stack: 'a', data: missing, itemStyle: { color: C.muted, borderRadius: [0, 4, 4, 0] }, barWidth: '55%' },
    ],
  }
})
</script>

<style scoped>
.page { width: 1064px; max-width: 1064px; padding: 48px 32px 80px; box-sizing: border-box; }
.page-head { margin-bottom: 24px; }
.page-title { font-family: 'Poppins'; font-size: 30px; font-weight: 800; letter-spacing: -0.6px; color: #0f172a; margin: 0; }
.inline-link { color: #ef4444; text-decoration: underline; font-weight: 600; }

/* Empty state */
.empty-state-card { background: #fff; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,.06); padding: 60px 24px; text-align: center; position: relative; overflow: hidden; }
.empty-ic { width: 48px; height: 48px; color: #e2e8f0; }
.empty-title { font-family: 'Poppins'; font-size: 17px; font-weight: 700; color: #94a3b8; margin-top: 14px; }
.empty-hint { font-size: 13.5px; color: #cbd5e1; margin-top: 6px; }

/* Tab bar (duplicated styling, not a shared component) */
.tab-bar-row { display: flex; align-items: center; margin-bottom: 20px; }
.tab-buttons { display: flex; gap: 8px; }
.tab-btn {
  background: #f1f5f9; border: none; border-radius: 99px; padding: 9px 20px;
  font-family: 'Poppins'; font-size: 13.5px; font-weight: 600; color: #475569;
  cursor: pointer; outline: none; transition: all .2s ease; white-space: nowrap;
}
.tab-btn:hover { background: #e2e8f0; color: #334155; }
.tab-btn.active-tab { background: var(--platform2, #ef4444); color: #fff; box-shadow: 0 2px 8px rgba(239,68,68,.25); }

.tab-fade-enter-active, .tab-fade-leave-active { transition: opacity .18s ease, transform .18s cubic-bezier(0.4,0,0.2,1); }
.tab-fade-enter-from { opacity: 0; transform: translateY(8px); }
.tab-fade-leave-to { opacity: 0; transform: translateY(-8px); }

.tab-panel { width: 100%; }

/* Scorecard */
.scorecard-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.sc-card { background: #fff; border-radius: 20px; padding: 20px 22px; box-shadow: 0 4px 16px rgba(0,0,0,.04); position: relative; overflow: hidden; }
.warn-card { background: #fffbeb; }
.sc-label { font-family: 'Inter'; font-size: 11px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; color: #94a3b8; display: block; }
.sc-val { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 6px; display: block; letter-spacing: -0.5px; }
.num-font { font-family: 'Inter', monospace; }

/* Charts grid */
.charts-grid--2col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.charts-grid--3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
.chart-card { min-height: 320px; }
.card { position: relative; background: #fff; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.03); padding: 24px; overflow: hidden; }
.chart-title { font-family: 'Poppins'; font-size: 15px; font-weight: 700; color: #0f172a; }
.chart-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; margin-bottom: 14px; }
.chart-wrap { width: 100%; }

@media (max-width: 1000px) {
  .page { width: 100%; }
  .scorecard-row { grid-template-columns: repeat(2, 1fr); }
  .charts-grid--3col { grid-template-columns: 1fr; }
  .charts-grid--2col { grid-template-columns: 1fr; }
}
</style>
