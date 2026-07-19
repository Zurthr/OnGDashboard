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
        <!-- Tab 1: Data Statistics -->
        <div v-if="activeTab === 'Data Statistics'" key="data" class="tab-panel">
          <div class="scorecard-row">
            <div class="sc-card">
              <span class="sc-label">Total AFEs</span>
              <span class="sc-val num-font">{{ store.totalRecords }}</span>
            </div>
            <div class="sc-card" :class="{ 'warn-card': pendingImportCount > 0 }">
              <span class="sc-label">Pending Import</span>
              <span class="sc-val num-font">{{ pendingImportCount }}</span>
            </div>
            <div class="sc-card">
              <span class="sc-label">Issues Resolved</span>
              <span class="sc-val num-font">{{ resolvedIssueCount }} <span class="sc-val-sub">out of {{ store.dlqEntries.length }}</span></span>
            </div>
            <div class="sc-card">
              <span class="sc-label">Last Updated</span>
              <span class="sc-val num-font">{{ lastUpdatedParts.value }} <span class="sc-val-sub">{{ lastUpdatedParts.unit }}</span></span>
            </div>
          </div>
          <div class="charts-grid charts-grid--2col">
            <section class="card chart-card">
              <h3 class="chart-title">Open Issues by Severity</h3>
              <p class="chart-sub">Breakdown of unresolved issues only</p>
              <div class="chart-wrap"><VChart :option="severityChart" autoresize style="height:260px" /></div>
            </section>
            <section class="card chart-card">
              <h3 class="chart-title">AFE Completeness</h3>
              <p class="chart-sub">{{ completeAfeCount }} of {{ store.totalRecords }} AFEs have every tracked field filled in</p>
              <div class="chart-wrap"><VChart :option="afeCompletenessChart" autoresize style="height:280px" /></div>
            </section>
          </div>
          <div class="charts-grid charts-grid--1col">
            <section class="card chart-card">
              <h3 class="chart-title">Data Completeness per Parameter</h3>
              <p class="chart-sub">Found vs missing per parameter</p>
              <div class="chart-wrap"><VChart :option="completenessChart" autoresize style="height:280px" /></div>
              <p v-if="topProblemParameter && topProblemParameter.missing > 0" class="chart-callout">
                Most problematic parameter: <strong>{{ topProblemParameter.label }}</strong>
                <br>Missing in {{ topProblemParameter.missing }} of {{ store.totalRecords }} AFEs
              </p>
            </section>
          </div>
        </div>

        <!-- Tab 2: Parameters -->
        <div v-else-if="activeTab === 'Parameters'" key="parameters" class="tab-panel">
          <div class="charts-grid charts-grid--1col">
            <section class="card chart-card">
              <h3 class="chart-title">Water Depth Distribution</h3>
              <p class="chart-sub">Histogram of water depth (meters)</p>
              <div class="chart-wrap"><VChart :option="waterDepthChart" autoresize style="height:260px" /></div>
            </section>
          </div>
          <div class="charts-grid charts-grid--3col">
            <section class="card chart-card">
              <h3 class="chart-title">Topside Weight Distribution</h3>
              <p class="chart-sub">Histogram of topside weight (MT)</p>
              <div class="chart-wrap"><VChart :option="topsideWeightChart" autoresize style="height:260px" /></div>
            </section>
            <section class="card chart-card">
              <h3 class="chart-title">Jacket Weight Distribution</h3>
              <p class="chart-sub">Histogram of jacket weight (MT)</p>
              <div class="chart-wrap"><VChart :option="jacketWeightChart" autoresize style="height:260px" /></div>
            </section>
            <section class="card chart-card">
              <h3 class="chart-title">Piling Weight Distribution</h3>
              <p class="chart-sub">Histogram of piling weight (MT)</p>
              <div class="chart-wrap"><VChart :option="pilingWeightChart" autoresize style="height:260px" /></div>
            </section>
          </div>
          <div class="charts-grid charts-grid--3col">
            <section class="card chart-card">
              <h3 class="chart-title">Impurity Levels</h3>
              <p class="chart-sub">H₂S, CO₂, and Hg (numeric records only)</p>
              <div class="chart-wrap"><VChart :option="impurityChart" autoresize style="height:280px" /></div>
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
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart, GaugeChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useAfeStore } from '~/stores/afeStore'

use([BarChart, GaugeChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
useHead({ title: 'SKK Migas — AFE Dashboard' })

const store = useAfeStore()

const extractedAfeNumbers = ref<string[]>([])

onMounted(async () => {
  store.fetchAll()
  try {
    const res = await $fetch<{ afe_numbers: string[] }>('/api/extract/extracted-afe-numbers')
    extractedAfeNumbers.value = res.afe_numbers
  } catch {
    // best-effort — stat just shows 0 if this fails
  }
})

const pendingImportCount = computed(() => {
  const importedSet = new Set(store.rows.map(r => r.afe_number))
  return extractedAfeNumbers.value.filter(afe => !importedSet.has(afe)).length
})

/* ── Tabs ─────────────────────────────────────────────── */
const tabs = ['Data Statistics', 'Parameters'] as const
const activeTab = ref<typeof tabs[number]>('Data Statistics')

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
  lightgreen: '#a7f3d0'
}

/* ── Helpers (keys match afe_records DB columns) ─────── */
const paramKeys = ['water_depth', 'topside_weight', 'jacket_weight', 'piling_weight', 'number_of_legs', 'number_of_slots', 'impurities_h2s', 'impurities_co2', 'impurities_hg']
const paramLabels: Record<string, string> = {
  water_depth: 'Water Depth', topside_weight: 'Topside Weight', jacket_weight: 'Jacket Weight',
  piling_weight: 'Piling Weight', number_of_legs: 'Legs', number_of_slots: 'Slots',
  impurities_h2s: 'H₂S', impurities_co2: 'CO₂', impurities_hg: 'Hg',
  topside_equipment_wellhead: 'Equipment Wellhead', topside_equipment_processing: 'Equipment Processing', topside_equipment_utilities: 'Equipment Utilities',
}

const severityChart = computed(() => {
  const bySeverity: Record<string, number> = {}
  for (const d of store.dlqEntries) {
    if (d.resolved) continue
    const key = d.severity || 'unspecified'
    bySeverity[key] = (bySeverity[key] || 0) + 1
  }
  const palette = [C.primary, C.secondary, C.tertiary, C.muted]
  return {
    tooltip: { ...tip, trigger: 'item' as const },
    legend: { bottom: 0, textStyle: { fontFamily: 'Inter', fontSize: 11, color: C.sub } },
    series: [{
      type: 'pie' as const,
      radius: ['45%', '70%'],
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: Object.entries(bySeverity).map(([name, value], i) => ({
        name, value, itemStyle: { color: palette[i % palette.length] },
      })),
    }],
  }
})
/* ── Per-AFE completeness — same "found" definition as the per-parameter
   chart below, just grouped by row instead of by column. An AFE counts as
   fully complete only if every one of its tracked fields has a value. ── */
const allCompletenessKeys = [
  ...paramKeys,
  'topside_equipment_wellhead', 'topside_equipment_processing', 'topside_equipment_utilities',
]
const completeAfeCount = computed(() =>
  store.rows.filter(r => allCompletenessKeys.every(k => r[k] != null && r[k] !== '')).length
)
const afeCompletenessChart = computed(() => {
  const complete = completeAfeCount.value
  const incomplete = store.totalRecords - complete
  return {
    tooltip: { ...tip, trigger: 'item' as const },
    legend: { bottom: 0, textStyle: { fontFamily: 'Inter', fontSize: 11, color: C.sub } },
    series: [{
      type: 'pie' as const,
      radius: ['45%', '70%'],
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [
        { name: 'Complete', value: complete, itemStyle: { color: C.green } },
        { name: 'Incomplete', value: incomplete, itemStyle: { color: C.lightgreen } },
      ],
    }],
  }
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
  makeHistogram(store.numericValues('topside_weight'), [0, 500, 1000, 1500, 2000, 2500, 3000], C.primary)
)
const jacketWeightChart = computed(() =>
  makeHistogram(store.numericValues('jacket_weight'), [0, 1000, 2000, 3000, 4000, 5000, 6000], C.secondary)
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
  const allKeys = ['water_depth', 'topside_weight', 'jacket_weight', 'piling_weight', 'number_of_legs', 'number_of_slots', 'topside_equipment_wellhead', 'topside_equipment_processing', 'topside_equipment_utilities', 'impurities_h2s', 'impurities_co2', 'impurities_hg']
  const labels = allKeys.map(k => paramLabels[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
  const total = store.totalRecords
  const found = allKeys.map(k => store.rows.filter(r => r[k] != null && r[k] !== '').length)
  const missing = found.map(f => total - f)
  return {
    grid: { left: 180, right: 24, top: 16, bottom: 24 }, tooltip: { ...tip, trigger: 'axis' as const },
    legend: { show: false },
    yAxis: { type: 'category' as const, data: labels, axisLabel, inverse: true },
    xAxis: { type: 'value' as const, max: total, splitLine, axisLabel },
    series: [
      { type: 'bar' as const, name: 'Found', stack: 'a', data: found, itemStyle: { color: C.green }, barWidth: '55%' },
      { type: 'bar' as const, name: 'Missing', stack: 'a', data: missing, itemStyle: { color: C.muted, borderRadius: [0, 4, 4, 0] }, barWidth: '55%' },
    ],
  }
})

/* Last Updated Time Script */
function timeAgoParts(sqliteDatetime: string): { value: string; unit: string } {
  const then = new Date(sqliteDatetime.replace(' ', 'T') + 'Z').getTime()
  const diffSec = Math.floor((Date.now() - then) / 1000)
  if (diffSec < 60) return { value: 'Just now', unit: '' }
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return { value: String(diffMin), unit: `minute${diffMin !== 1 ? 's' : ''} ago` }
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return { value: String(diffHour), unit: `hour${diffHour !== 1 ? 's' : ''} ago` }
  const diffDay = Math.floor(diffHour / 24)
  return { value: String(diffDay), unit: `day${diffDay !== 1 ? 's' : ''} ago` }
}
const lastUpdatedParts = computed(() => {
  const timestamps = store.rows.map(r => r.updated_at).filter(Boolean) as string[]
  if (timestamps.length === 0) return { value: '—', unit: '' }
  return timeAgoParts(timestamps.reduce((latest, t) => (t > latest ? t : latest)))
})

/* Problem Priority Script*/
const topProblemParameter = computed(() => {
  const allKeys = [...paramKeys, 'topside_equipment_wellhead', 'topside_equipment_processing', 'topside_equipment_utilities']
  const total = store.totalRecords
  let worst: { label: string; missing: number } | null = null
  for (const k of allKeys) {
    const found = store.rows.filter(r => r[k] != null && r[k] !== '').length
    const missing = total - found
    if (!worst || missing > worst.missing) {
      worst = { label: paramLabels[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), missing }
    }
  }
  return worst
})

/* Issue Resolution Script */
const resolvedIssueCount = computed(() => store.dlqEntries.filter(d => d.resolved).length)

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
.tab-btn.active-tab { background: var(--platform2, #ef4444); color: #000000; box-shadow: 0 2px 8px rgba(239,68,68,.25); }

.tab-fade-enter-active, .tab-fade-leave-active { transition: opacity .18s ease, transform .18s cubic-bezier(0.4,0,0.2,1); }
.tab-fade-enter-from { opacity: 0; transform: translateY(8px); }
.tab-fade-leave-to { opacity: 0; transform: translateY(-8px); }

.tab-panel { width: 100%; }

.chart-callout { font-size: 12.5px; color: #64748b; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9; }
.chart-callout strong { color: #0f172a; }

/* Scorecard */
.scorecard-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.sc-card { background: #fff; border-radius: 20px; margin-bottom: 24px; padding: 15px 15px; box-shadow: 0 4px 16px rgba(0,0,0,.04); position: relative; overflow: hidden; }
.warn-card { background: #fffbeb; }
.sc-label { font-family: 'Inter'; font-size: 11px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; color: #94a3b8; display: block; }
.sc-val { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 6px; display: block; letter-spacing: -0.5px; }
.sc-val-sub { font-size: 15px; font-weight: 600; color: #94a3b8; margin-left: 2px; }
.num-font { font-family: 'Inter', monospace; }

/* Charts grid */
.charts-grid--2col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.charts-grid--3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
.chart-card { min-height: 320px; margin-bottom: 24px; }
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
