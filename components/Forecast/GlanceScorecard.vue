<template>
  <div class="at-a-glance-section">
    <h2 class="section-title">At a Glance</h2>
    <div class="scorecard-row">
      <!-- Card 1: Forecasted Cost (USD) -->
      <div class="scorecard-card neutral-card" style="min-width:164px">
        <span class="card-label">Forecasted Cost (USD)</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <span v-else class="card-val num-font">{{ formatCurrency(adjusted.totalAdjusted) }}</span>
        <span v-if="!store.loadingDetails" class="card-subtitle">
          <span class="subtext-bold num-font">{{ baselineCostPerTon }}</span> <span class="subtext-unit">US/ton</span>
        </span>
      </div>

      <!-- Card 2: Comparation (USD) - Read-only display -->
      <div class="scorecard-card pink-card" style="min-width:164px">
        <span class="card-label">Comparation (USD)</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <span v-else class="card-val num-font">
          {{ hasComparation ? formatCurrency(comparationTotal) : '-' }}
        </span>
        <span v-if="!store.loadingDetails" class="card-subtitle">
          <span class="subtext-bold num-font">{{ hasComparation ? comparationCostPerTon : '-' }}</span>
          <span class="subtext-unit"> US/ton</span>
        </span>
      </div>

      <!-- Card 3: Variance -->
      <div class="scorecard-card variance-card" style="min-width:164px">
        <span class="card-label">Variance</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <span v-else class="card-val num-font">
          {{ hasComparation ? formatCurrency(varianceTotal) : '-' }}
        </span>
        <span v-if="!store.loadingDetails" class="card-subtitle">
          <span class="subtext-bold num-font">{{ hasComparation ? varianceCostPerTon : '-' }}</span>
          <span class="subtext-unit"> US/ton</span>
        </span>
      </div>

      <!-- Card 4: % Deviation -->
      <div class="scorecard-card neutral-card">
        <span class="card-label">% Deviation</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <span v-else class="card-val num-font">
          {{ hasComparation ? percentageDeviation + '%' : '-' }}
        </span>
        <div v-if="!store.loadingDetails && hasComparation" class="severity-badge-container">
          <span class="severity-pill" :class="getSeverityBadgeClass(percentageDeviation)">
            {{ getSeverityLabel(percentageDeviation) }}
          </span>
        </div>          
      </div>

      <!-- Card 5: Dominant Driver -->
      <div class="scorecard-card neutral-card">
        <span class="card-label">Dominant Driver</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <template v-else>
          <span class="card-val num-font">{{ hasComparation ? dominantDriverRatio + '%' : '-' }}</span>
          <span class="card-subtitle dominant-driver-names">
            <template v-if="hasComparation && dominantDriverPrimary">
              {{ dominantDriverPrimary }}
              <span v-if="dominantDriverMoreCount > 0" class="driver-more"> + {{ dominantDriverMoreCount }} more</span>
            </template>
            <template v-else>-</template>
          </span>
        </template>
      </div>

      <!-- Card 6: Historical Status -->
      <div class="scorecard-card neutral-card">
        <span class="card-label">Historical Status</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <template v-else>
          <span class="card-val">{{ hasComparation ? historicalStatusLabel : '-' }}</span>
          <span class="card-subtitle">Range</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePlatformVedaStore } from '~/stores/platformVedaStore'
import { useSubseaVedaStore } from '~/stores/subseaVedaStore'
import { useFpsoVedaStore } from '~/stores/fpsoVedaStore'
import { useRoute } from 'vue-router'
import { useFormatters } from '~/composables/useFormatters'
import { useKkksAdjustedForecasts } from '~/composables/useKkksAdjustedForecasts'
import { useForecastStore } from '~/composables/useForecastStore'

const store = useForecastStore()
const { formatCurrency, formatCostPerTon, getSeverityLabel, getSeverityBadgeClass } = useFormatters()

const totalTonnage = computed(() => {
  const p = store.navParams
  const topside = Number(p.topside) || 0
  const jacket = Number(p.jacket) || 0
  const piles = Number(p.piles) || 0
  const conductor = Number(p.conductor) || 0
  const total = topside + jacket + piles + conductor
  return total > 0 ? total : null
})

//  KKKS MODIFIER 
const { result: adjusted } = useKkksAdjustedForecasts(
  () => store.componentFindings,
  () => store.selectedKkks ?? null,
  () => (store.kkksModifierMode ?? 'none') as 'none' | 'median' | 'mean'
)

// Compute comparation total from store inputs
const hasComparation = computed(() => {
  const keys = Object.keys(store.comparationInputs || {})
  if (keys.length === 0) return false
  return store.componentFindings.every(c => {
    const val = store.comparationInputs[c.costType]
    return val !== undefined && val !== null && (val as any) !== ''
  })
})

const comparationTotal = computed(() => {
  if (!hasComparation.value) return 0
  return store.componentFindings.reduce((sum, c) => {
    const val = Number(store.comparationInputs[c.costType]) || 0
    return sum + val
  }, 0)
})

const varianceTotal = computed(() => {
  if (!hasComparation.value) return 0
  return comparationTotal.value - adjusted.value.totalAdjusted
})

const percentageDeviation = computed(() => {
  const base = adjusted.value.totalAdjusted
  if (!hasComparation.value || base === 0) return 0
  return Number(((varianceTotal.value / base) * 100).toFixed(2))
})

const baselineCostPerTon = computed(() =>
  formatCostPerTon(adjusted.value.totalAdjusted, totalTonnage.value)
)

const comparationCostPerTon = computed(() =>
  formatCostPerTon(comparationTotal.value, totalTonnage.value)
)

const varianceCostPerTon = computed(() =>
  formatCostPerTon(varianceTotal.value, totalTonnage.value)
)

const formatCostTypeLabel = (costType: string) =>
  costType.replace(/ (Costs|Cost)/g, '')

const dominantDriverComponents = computed(() => {
  if (!hasComparation.value) return []
  return store.componentFindings
    .map(c => {
      const compVal = Number(store.comparationInputs[c.costType]) || 0
      const absVar = compVal - c.baseline
      return {
        costType: c.costType,
        absoluteVariance: absVar,
        isDominantDriver: c.isDominantDriver
      }
    })
    .filter(c => c.isDominantDriver)
    .sort((a, b) => Math.abs(b.absoluteVariance) - Math.abs(a.absoluteVariance))
})

const dominantDriverRatio = computed(() => {
  if (!hasComparation.value) return 0
  const drivers = dominantDriverComponents.value
  if (drivers.length === 0) return 0

  const totalAbsVariance = store.componentFindings.reduce((sum, c) => {
    const compVal = Number(store.comparationInputs[c.costType]) || 0
    return sum + Math.abs(compVal - c.baseline)
  }, 0)
  if (totalAbsVariance === 0) return 0

  const driverAbsVariance = drivers.reduce(
    (sum, c) => sum + Math.abs(c.absoluteVariance),
    0,
  )

  return Number(((driverAbsVariance / totalAbsVariance) * 100).toFixed(2))
})

const dominantDriverPrimary = computed(() => {
  if (!hasComparation.value) return ''
  if (dominantDriverComponents.value.length > 0) {
    return formatCostTypeLabel(dominantDriverComponents.value[0].costType)
  }
  const fromApi = store.computedJson?.dominantDrivers as string | undefined
  if (!fromApi || fromApi === 'None') return ''
  return formatCostTypeLabel(fromApi.split(', ')[0])
})

const dominantDriverMoreCount = computed(() => {
  if (!hasComparation.value) return 0
  if (dominantDriverComponents.value.length > 1) {
    return dominantDriverComponents.value.length - 1
  }
  const fromApi = store.computedJson?.dominantDrivers as string | undefined
  if (!fromApi || fromApi === 'None') return 0
  return Math.max(0, fromApi.split(', ').length - 1)
})

const historicalStatusLabel = computed(() => {
  if (store.computedJson?.overallSeverity === 'HIGH') return 'Unpreced.'
  if (store.computedJson?.overallSeverity === 'MEDIUM') return 'Outlier'
  return 'Normal'
})
</script>

<style scoped>
/* =============================================
   AT A GLANCE SCORECARD ROW
   ============================================= */
.at-a-glance-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 16px;
  letter-spacing: -0.3px;
}

.scorecard-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}

.scorecard-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 100px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s, box-shadow 0.2s;
}

.scorecard-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.neutral-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
}

.pink-card {
  background-color: #fdf0f0;
  border: 1px solid #fecaca;
}

.variance-card {
  background-color: #f6fbee;
  border: 1.5px solid #a3c96c;
}

.card-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 6px;
  text-transform: capitalize;
}

.card-val {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.1;
  letter-spacing: -0.5px;
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-top: 4px;
}



.dominant-driver-names {
  line-height: 1.35;
}

.driver-more {
  color: #94a3b8;
  font-weight: 400;
}

.subtext-bold {
  font-weight: 700;
  color: #334155;
}

.subtext-unit {
  font-weight: 400;
}

.card-val-skeleton {
  width: 80%;
  height: 28px;
  margin-bottom: 4px;
}

/* Severity Pill inside Variance Card */
.severity-badge-container {
  margin-top: 0;
}

.severity-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 99px;
  display: inline-block;
  text-transform: capitalize;
}

.badge-low {
  background-color: #dcfce7;
  color: #15803d;
}

.badge-medium {
  background-color: #fef3c7;
  color: #b45309;
}

.badge-high {
  background-color: #fee2e2;
  color: #b91c1c;
}

.badge-critical {
  background-color: #7f1d1d;
  color: #ffffff;
}

.num-font {
  font-family: var(--font-number);
}
</style>
