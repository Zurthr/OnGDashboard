<template>
  <div class="page">
    <div class="page-head">
      <div>
        <span class="eyebrow">AFE Module</span>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">
          Visual overview of the curated AFE repository. Import data on the
          <NuxtLink to="/repo" class="inline-link">Repository</NuxtLink> page — charts update automatically.
        </p>
      </div>
    </div>

    <!-- No-data state -->
    <div v-if="!store.curatedImported" class="empty-state-card">
      <Icon name="heroicons:chart-bar" class="empty-ic" />
      <p class="empty-title">No data to visualize</p>
      <p class="empty-hint">
        Import <strong>curated_records.csv</strong> on the
        <NuxtLink to="/repo" class="inline-link">Repository</NuxtLink> page first.
      </p>
    </div>

    <template v-else>
      <!-- Scorecard strip -->
      <div class="scorecard-row">
        <div class="sc-card">
          <span class="sc-label">Total AFEs</span>
          <span class="sc-val num-font">{{ store.totalRecords }}</span>
        </div>
        <div class="sc-card pink-card">
          <span class="sc-label">Platform</span>
          <span class="sc-val num-font">{{ store.platformCount }}</span>
        </div>
        <div class="sc-card">
          <span class="sc-label">Avg Water Depth</span>
          <span class="sc-val num-font">{{ store.avgWaterDepth }}</span>
        </div>
        <div class="sc-card">
          <span class="sc-label">Data Completeness</span>
          <span class="sc-val num-font">{{ overallCompleteness }}%</span>
        </div>
      </div>

      <!-- Charts grid -->
      <div class="charts-grid">
        <!-- Water Depth Distribution -->
        <section class="card chart-card">
          <span class="card-bar"></span>
          <h3 class="chart-title">Water Depth Distribution</h3>
          <p class="chart-sub">Histogram of water depth across all AFEs (meters)</p>
          <div class="chart-wrap">
            <VChart :option="waterDepthChart" autoresize style="height:280px" />
          </div>
        </section>

        <!-- Weight Comparison -->
        <section class="card chart-card">
          <span class="card-bar"></span>
          <h3 class="chart-title">Weight Comparison</h3>
          <p class="chart-sub">Topside, Jacket, and Piling weights by project</p>
          <div class="chart-wrap">
            <VChart :option="weightChart" autoresize style="height:280px" />
          </div>
        </section>

        <!-- Number of Legs -->
        <section class="card chart-card">
          <span class="card-bar"></span>
          <h3 class="chart-title">Platforms by Number of Legs</h3>
          <p class="chart-sub">Count of platforms per leg configuration</p>
          <div class="chart-wrap">
            <VChart :option="legsChart" autoresize style="height:260px" />
          </div>
        </section>

        <!-- Number of Slots -->
        <section class="card chart-card">
          <span class="card-bar"></span>
          <h3 class="chart-title">Platforms by Number of Slots</h3>
          <p class="chart-sub">Well-slot capacity distribution</p>
          <div class="chart-wrap">
            <VChart :option="slotsChart" autoresize style="height:260px" />
          </div>
        </section>

        <!-- Impurities -->
        <section class="card chart-card chart-card--wide">
          <span class="card-bar"></span>
          <h3 class="chart-title">Impurity Levels</h3>
          <p class="chart-sub">H₂S, CO₂, and Hg across projects (numeric records only)</p>
          <div class="chart-wrap">
            <VChart :option="impurityChart" autoresize style="height:300px" />
          </div>
        </section>

        <!-- Data Completeness -->
        <section class="card chart-card chart-card--wide">
          <span class="card-bar"></span>
          <h3 class="chart-title">Data Completeness per Parameter</h3>
          <p class="chart-sub">Proportion of AFEs where each parameter was found vs missing</p>
          <div class="chart-wrap">
            <VChart :option="completenessChart" autoresize style="height:280px" />
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useAfeStore } from '~/stores/afeStore'

use([BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])
useHead({ title: 'SKK Migas — AFE Dashboard' })

const store = useAfeStore()

/* ── Color palette (matches the coral/red/amber system) ── */
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

/* ── Helpers ──────────────────────────────────────────── */
const paramKeys = ['water_depth', 'topside_weight', 'jacket_weight', 'piling_weight', 'number_of_legs', 'number_of_slots', 'h2s', 'co2', 'hg']
const paramLabels: Record<string, string> = {
  water_depth: 'Water Depth', topside_weight: 'Topside Wt', jacket_weight: 'Jacket Wt',
  piling_weight: 'Piling Wt', number_of_legs: 'Legs', number_of_slots: 'Slots',
  h2s: 'H₂S', co2: 'CO₂', hg: 'Hg',
}

const overallCompleteness = computed(() => {
  const total = store.totalRecords * paramKeys.length
  const found = paramKeys.reduce((acc, k) => acc + store.numericValues(k).length, 0)
  // Also count non-numeric found values (equipment text)
  const textKeys = ['equip_wellhead', 'equip_processing', 'equip_utilities']
  const textFound = textKeys.reduce((acc, k) => acc + store.rows.filter(r => r[k] != null && r[k] !== '').length, 0)
  const adjTotal = total + store.totalRecords * textKeys.length
  return adjTotal ? Math.round(((found + textFound) / adjTotal) * 100) : 0
})

/* ── Shared chart config ─────────────────────────────── */
const baseGrid = { left: 48, right: 24, top: 24, bottom: 32 }
const tip = { backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: C.text, fontFamily: 'Inter', fontSize: 12 } }
const axisLabel = { fontFamily: 'Inter', fontSize: 11, color: C.sub }
const splitLine = { lineStyle: { color: C.grid } }

/* ── Water Depth Histogram ───────────────────────────── */
const waterDepthChart = computed(() => {
  const vals = store.numericValues('water_depth')
  const bins = [0, 30, 60, 90, 120, 150, 200]
  const labels = bins.slice(0, -1).map((b, i) => `${b}–${bins[i + 1]}`)
  const counts = labels.map((_, i) => vals.filter(v => v >= bins[i] && v < bins[i + 1]).length)
  return {
    grid: baseGrid, tooltip: { ...tip, trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: labels, axisLabel },
    yAxis: { type: 'value' as const, splitLine, axisLabel },
    series: [{ type: 'bar' as const, data: counts, barWidth: '60%', itemStyle: { color: C.primary, borderRadius: [6, 6, 0, 0] } }],
  }
})

/* ── Weight Comparison (grouped bar) ─────────────────── */
const weightChart = computed(() => {
  const rows = store.rows.filter(r =>
    typeof r.topside_weight === 'number' || typeof r.jacket_weight === 'number' || typeof r.piling_weight === 'number'
  )
  const labels = rows.map(r => (r.asset_name || r.afe_number || '?') as string)
  const series = [
    { name: 'Topside', key: 'topside_weight', color: C.primary },
    { name: 'Jacket', key: 'jacket_weight', color: C.secondary },
    { name: 'Piling', key: 'piling_weight', color: C.tertiary },
  ]
  return {
    grid: { ...baseGrid, bottom: 48 }, tooltip: { ...tip, trigger: 'axis' as const },
    legend: { bottom: 0, textStyle: { fontFamily: 'Inter', fontSize: 11, color: C.sub } },
    xAxis: { type: 'category' as const, data: labels, axisLabel: { ...axisLabel, rotate: 20 } },
    yAxis: { type: 'value' as const, name: 'MT', splitLine, axisLabel },
    series: series.map(s => ({
      type: 'bar' as const, name: s.name,
      data: rows.map(r => (typeof r[s.key] === 'number' ? r[s.key] : 0) as number),
      itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] }, barGap: '10%',
    })),
  }
})

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
    typeof r.h2s === 'number' || typeof r.co2 === 'number' || typeof r.hg === 'number'
  )
  const labels = rows.map(r => (r.asset_name || r.afe_number || '?') as string)
  return {
    grid: { ...baseGrid, bottom: 48 }, tooltip: { ...tip, trigger: 'axis' as const },
    legend: { bottom: 0, textStyle: { fontFamily: 'Inter', fontSize: 11, color: C.sub } },
    xAxis: { type: 'category' as const, data: labels, axisLabel },
    yAxis: { type: 'value' as const, splitLine, axisLabel },
    series: [
      { type: 'bar' as const, name: 'H₂S', data: rows.map(r => (typeof r.h2s === 'number' ? r.h2s : 0) as number), itemStyle: { color: C.primary, borderRadius: [4, 4, 0, 0] } },
      { type: 'bar' as const, name: 'CO₂', data: rows.map(r => (typeof r.co2 === 'number' ? r.co2 : 0) as number), itemStyle: { color: C.secondary, borderRadius: [4, 4, 0, 0] } },
      { type: 'bar' as const, name: 'Hg', data: rows.map(r => (typeof r.hg === 'number' ? r.hg : 0) as number), itemStyle: { color: C.tertiary, borderRadius: [4, 4, 0, 0] } },
    ],
  }
})

/* ── Completeness horizontal bar ─────────────────────── */
const completenessChart = computed(() => {
  const allKeys = [...paramKeys, 'equip_wellhead', 'equip_processing', 'equip_utilities']
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
.page-head { margin-bottom: 28px; }
.eyebrow { font-family: 'Inter'; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; }
.page-title { font-family: 'Poppins'; font-size: 30px; font-weight: 800; letter-spacing: -0.6px; color: #0f172a; margin-top: 4px; }
.page-sub { font-size: 14.5px; color: #64748b; max-width: 620px; margin-top: 8px; line-height: 1.6; }
.inline-link { color: #ef4444; text-decoration: underline; font-weight: 600; }

/* Empty state */
.empty-state-card { background: #fff; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,.06); padding: 60px 24px; text-align: center; position: relative; overflow: hidden; }
.empty-state-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--platform); opacity: .85; }
.empty-ic { width: 48px; height: 48px; color: #e2e8f0; }
.empty-title { font-family: 'Poppins'; font-size: 17px; font-weight: 700; color: #94a3b8; margin-top: 14px; }
.empty-hint { font-size: 13.5px; color: #cbd5e1; margin-top: 6px; }

/* Scorecard */
.scorecard-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.sc-card { background: #fff; border-radius: 20px; padding: 20px 22px; box-shadow: 0 4px 16px rgba(0,0,0,.04); position: relative; overflow: hidden; }
.sc-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--platform); opacity: .7; }
.pink-card { background: #fff5f5; }
.pink-card::before { background: #ef4444; opacity: .9; }
.sc-label { font-family: 'Inter'; font-size: 11px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; color: #94a3b8; display: block; }
.sc-val { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 6px; display: block; letter-spacing: -0.5px; }
.num-font { font-family: 'Inter', monospace; }

/* Charts grid */
.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.chart-card { min-height: 340px; }
.chart-card--wide { grid-column: 1 / -1; }
.card { position: relative; background: #fff; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.03); padding: 28px; overflow: hidden; }
.card-bar { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--platform); opacity: .85; }
.chart-title { font-family: 'Poppins'; font-size: 16px; font-weight: 700; color: #0f172a; }
.chart-sub { font-size: 12.5px; color: #94a3b8; margin-top: 2px; margin-bottom: 16px; }
.chart-wrap { width: 100%; }

@media (max-width: 900px) { .page { width: 100%; } .scorecard-row { grid-template-columns: repeat(2, 1fr); } .charts-grid { grid-template-columns: 1fr; } }
</style>
