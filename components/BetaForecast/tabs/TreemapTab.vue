<template>
  <div class="treemap-tab">
    <div class="treemap-card">

      <!-- Header -->
      <div class="treemap-card-header">
        <div class="treemap-card-titles">
          <div class="title-with-icon">
            <Icon name="heroicons:squares-2x2-20-solid" class="card-title-icon" />
            <h3 class="card-chart-title">Cost Composition Treemap</h3>
          </div>
          <span class="card-chart-subtitle">{{ subtitleText }}</span>
        </div>
      </div>

      <!-- Chart -->
      <div class="treemap-chart-wrapper">
        <component
          :is="VChart"
          v-if="VChart && hasData"
          :option="treemapOption"
          class="treemap-echart"
          :autoresize="true"
        />
        <div v-else-if="!hasData" class="treemap-empty">
          <Icon name="heroicons:chart-bar-square-20-solid" class="empty-icon" />
          <span>No scenario data loaded yet.</span>
        </div>
        <div v-else class="treemap-loading">
          <span>Loading chart…</span>
        </div>
      </div>

      <!-- Legend — swatch always visible, label reveals on hover -->
      <div class="treemap-legend" v-if="mode === 'variance'">
        <div class="legend-item" v-for="entry in legendEntries" :key="entry.label">
          <span class="legend-swatch" :style="{ background: entry.color }"></span>
          <span class="legend-label"><strong>{{ entry.label }}</strong> — {{ entry.desc }}</span>
        </div>
      </div>
      <div class="treemap-legend" v-else>
        <div class="legend-item" v-for="entry in catLegendEntries" :key="entry.label">
          <span class="legend-swatch" :style="{ background: entry.color }"></span>
          <span class="legend-label"><strong>{{ entry.label }}</strong> — {{ entry.desc }}</span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, onMounted } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

// ── Props ─────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  mode?: 'variance' | 'baseline' | 'forecast'
}>(), { mode: 'variance' })

const store = useVedaStore()

// ── Lazy ECharts load ─────────────────────────────────────────────────────
const VChart = shallowRef<any>(null)

onMounted(async () => {
  if (!process.client) return
  try {
    const echarts = await import('echarts/core')
    if (process.client) {
      (window as any).echarts = echarts
    }
    const { TreemapChart } = await import('echarts/charts')
    const { TooltipComponent } = await import('echarts/components')
    const { CanvasRenderer } = await import('echarts/renderers')
    echarts.use([TreemapChart, TooltipComponent, CanvasRenderer])
    const { default: vc } = await import('vue-echarts')
    VChart.value = vc
  } catch (err) {
    console.error('Failed to load ECharts Treemap:', err)
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────
const hasData = computed(() => store.componentFindings.length > 0)

const fmt = (val: number): string => {
  const abs = Math.abs(val)
  if (abs >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `$${(val / 1_000).toFixed(1)}K`
  return `$${val.toFixed(0)}`
}

const fmtFull = (val: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)

const getAbbreviation = (costType: string): string => {
  const t = costType.toLowerCase()
  if (t.includes('pipeline'))                                                        return 'PL'
  if (t.includes('facility') || t.includes('facilities') || t.includes('production')) return 'PF'
  if (t.includes('deck') || (t.includes('structure') && !t.includes('sub')))         return 'DS'
  if (t.includes('substructure') || t.includes('sub-structure'))                     return 'SUB'
  if (t.includes('certif') || t.includes('permit'))                                  return 'C&F'
  if (t.includes('support') || t.includes('general'))                                return 'GS'
  return 'OTH'
}

// ── Variance color encoding ───────────────────────────────────────────────
const getVarianceColor = (isDominant: boolean, isIncrease: boolean, ratio: number): string => {
  if (!isIncrease) return '#3B9E6A'
  if (isDominant)  return '#D85A30'
  if (ratio >= 20) return '#E8851A'
  if (ratio >= 10) return '#F0A830'
  return '#F5C842'
}

// ── Categorical palette for baseline/forecast modes ───────────────────────
const CAT_PALETTE: Record<string, string> = {
  PL:    '#E59898', // Red
  PF:    '#F0B27A', // Orange
  DS:    '#F7DC6F', // Yellow
  'C&F': '#A9DFBF', // Green
  SUB:   '#AED6F1', // Blue
  GS:    '#D2B4DE', // Purple
  OTH:   '#D5D8DC', // Grey
}

// ── Dynamic subtitle ──────────────────────────────────────────────────────
const subtitleText = computed(() => {
  if (props.mode === 'baseline') return 'Size reflects baseline cost. Colors are categorical.'
  if (props.mode === 'forecast') return 'Size reflects forecasted cost. Colors are categorical.'
  return 'Size reflects forecasted cost. Color reflects variance direction and driver significance.'
})

// ── Legend entries (variance mode) ──────────────────────────────────
const legendEntries = [
  { color: '#D85A30', label: 'Dominant driver',    desc: 'highest variance contributor (increase)' },
  { color: '#E8851A', label: 'Major contributor',  desc: '≥20% of total variance (increase)'       },
  { color: '#F0A830', label: 'Mid contributor',    desc: '10–20% of total variance (increase)'     },
  { color: '#F5C842', label: 'Minor contributor',  desc: '<10% of total variance (increase)'       },
  { color: '#3B9E6A', label: 'Cost decrease',      desc: 'forecast below baseline (favorable)'     },
]

// ── Legend entries (categorical mode) ──────────────────────────────
const catLegendEntries = [
  { color: '#E59898', label: 'PL',   desc: 'Pipeline' },
  { color: '#F0B27A', label: 'PF',   desc: 'Production Facilities' },
  { color: '#F7DC6F', label: 'DS',   desc: 'Deck Structure' },
  { color: '#A9DFBF', label: 'C&F',  desc: 'Certifications and Permits' },
  { color: '#AED6F1', label: 'SUB',  desc: 'Substructure' },
  { color: '#D2B4DE', label: 'GS',   desc: 'General Support' },
]

// ── Treemap option ────────────────────────────────────────────────────────
const treemapOption = computed(() => {
  const mode = props.mode

  const items = store.componentFindings.map(f => {
    const abbr       = getAbbreviation(f.costType)
    const isIncrease = f.absoluteVariance >= 0
    const direction  = isIncrease ? 'Increase ▲' : 'Decrease ▼'
    const contribStr = `${f.contributionRatio > 0 ? '+' : ''}${f.contributionRatio.toFixed(2)}%`

    // Value and color driven by mode
    let value: number
    let color: string
    let labelLine2: string
    let labelLine3: string

    if (mode === 'baseline') {
      value      = f.baseline
      color      = CAT_PALETTE[abbr] ?? CAT_PALETTE.OTH
      labelLine2 = fmt(f.baseline)
      labelLine3 = fmtFull(f.baseline).replace('US', '').replace('$', '$') // compact
    } else if (mode === 'forecast') {
      value      = f.forecast
      color      = CAT_PALETTE[abbr] ?? CAT_PALETTE.OTH
      labelLine2 = fmt(f.forecast)
      labelLine3 = fmt(f.absoluteVariance) + ' var'
    } else {
      // variance (default)
      value      = f.forecast
      color      = getVarianceColor(f.isDominantDriver, isIncrease, Math.abs(f.contributionRatio))
      labelLine2 = fmt(f.absoluteVariance)
      labelLine3 = contribStr
    }

    return {
      name: f.costType,
      value,
      _abbr: abbr,
      _variance: f.absoluteVariance,
      _baseline: f.baseline,
      _forecast: f.forecast,
      _pctDev: f.percentageDeviation,
      _direction: direction,
      _contribStr: contribStr,
      itemStyle: { color, borderColor: '#ffffff', borderWidth: 2 },
      label: {
        show: true,
        formatter: () => [
          `{abbr|${abbr}}`,
          `{val|${labelLine2}}`,
          `{pct|${labelLine3}}`,
        ].join('\n'),
        rich: {
          abbr: { color: '#ffffff', fontWeight: 700, fontSize: 13, fontFamily: 'Inter, Poppins, sans-serif', lineHeight: 20 },
          val:  { color: 'rgba(255,255,255,0.92)', fontWeight: 600, fontSize: 11, fontFamily: 'monospace', lineHeight: 16 },
          pct:  { color: 'rgba(255,255,255,0.80)', fontWeight: 500, fontSize: 10, fontFamily: 'monospace', lineHeight: 15 },
        }
      }
    }
  })

  return {
    animation: true,
    animationDuration: 500,
    animationEasing: 'cubicOut' as const,
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (params: any) => {
        const d = params.data
        if (!d._baseline) return params.name
        const increase = d._variance >= 0
        const varColor = increase ? '#D85A30' : '#3B9E6A'
        return `
          <div style="font-family:'Inter',sans-serif;font-size:12px;padding:6px;line-height:1.8;min-width:220px;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:6px;border-bottom:1px solid #f1f5f9;padding-bottom:4px;">${d.name}</div>
            <div><span style="color:#64748b;">Baseline:</span> <strong>${fmtFull(d._baseline)}</strong></div>
            <div><span style="color:#64748b;">Forecast:</span> <strong>${fmtFull(d._forecast)}</strong></div>
            <div><span style="color:#64748b;">Variance:</span> <strong style="color:${varColor};">${increase ? '+' : ''}${fmtFull(d._variance)}</strong></div>
            <div><span style="color:#64748b;">Deviation:</span> <strong style="color:${varColor};">${d._pctDev > 0 ? '+' : ''}${d._pctDev}%</strong></div>
            <div><span style="color:#64748b;">Contribution:</span> <strong>${d._contribStr}</strong></div>
            <div style="margin-top:4px;">
              <span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;
                background:${increase ? '#fee2e2' : '#dcfce7'};color:${increase ? '#991b1b' : '#166534'};">
                ${d._direction}
              </span>
            </div>
          </div>`
      }
    },
    series: [{
      type: 'treemap',
      roam: false,
      leafDepth: 1,
      breadcrumb: { show: false },
      width: '100%', height: '100%',
      top: 0, left: 0, right: 0, bottom: 0,
      itemStyle: { borderColor: '#ffffff', borderWidth: 2, gapWidth: 2 },
      label: { show: true, position: 'insideTopLeft' as const, padding: [8, 8] },
      upperLabel: { show: false },
      levels: [{ itemStyle: { borderWidth: 0, gapWidth: 2 }, upperLabel: { show: false } }],
      data: items,
    }]
  }
})
</script>

<style scoped>
.treemap-tab { width: 100%; }

/* ── Card — fixed 480px ──────────────────────────────────── */
.treemap-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-md, 12px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 480px;
  box-sizing: border-box;
}

/* ── Header ───────────────────────────────────────────────── */
.treemap-card-header { display: flex; align-items: flex-start; justify-content: space-between; }
.treemap-card-titles { display: flex; flex-direction: column; gap: 3px; }
.title-with-icon     { display: flex; align-items: center; gap: 6px; }

.card-title-icon { width: 16px; height: 16px; color: #D85A30; flex-shrink: 0; }
.card-chart-title { font-size: 13px; font-weight: 700; color: #0f172a; margin: 0; }
.card-chart-subtitle { font-size: 11px; color: #94a3b8; line-height: 1.4; }

/* ── Chart — max 380px, fills remaining card space ────────── */
.treemap-chart-wrapper {
  width: 100%;
  flex: 1;
  max-height: 380px;
  position: relative;
  overflow: hidden;
}

.treemap-echart { width: 100% !important; height: 100% !important; }

.treemap-loading,
.treemap-empty {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px; color: #94a3b8; font-size: 13px;
}
.empty-icon { width: 36px; height: 36px; color: #cbd5e1; }

/* ── Legend — swatch always visible, text on hover ──────── */
.treemap-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: default;
  /* clip overflow so text expansion doesn't shift layout */
  max-width: 18px;
  overflow: hidden;
  transition: max-width 0.25s ease;
}

.legend-item:hover {
  max-width: 280px; /* wide enough for any label */
}

.legend-swatch {
  width: 12px; height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  font-size: 11px; color: #64748b; font-weight: 400;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s ease 0.05s;
}

.legend-item:hover .legend-label { opacity: 1; }
.legend-label strong { font-weight: 700; color: #334155; }
</style>
