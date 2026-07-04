<template>
  <div class="at-a-glance-section">
    <h2 class="section-title">At a Glance</h2>
    <div class="scorecard-row">
      <!-- Card 1: Cost Basis (USD) -->
      <div class="scorecard-card neutral-card" style="min-width:164px">
        <span class="card-label">Cost Basis (USD)</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <span v-else class="card-val num-font">{{ formatCurrency(store.summaryFindings.baselineTotal) }}</span>
        <span class="card-subtitle">
          <span class="subtext-bold">1,097</span> <span class="subtext-unit">US$/ft</span>
        </span>
      </div>

      <!-- Card 2: Forecasted (USD) -->
      <div class="scorecard-card pink-card" style="min-width:164px">
        <span class="card-label">Forecasted (USD)</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <span v-else class="card-val num-font">{{ formatCurrency(store.summaryFindings.forecastTotal) }}</span>
        <span class="card-subtitle">
          <span class="subtext-bold">1,097</span> <span class="subtext-unit">US$/ft</span>
        </span>
      </div>

      <!-- Card 3: Variance -->
      <div class="scorecard-card variance-card" style="min-width:164px">
        <span class="card-label">Variance</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <span v-else class="card-val num-font">{{ formatCurrency(store.summaryFindings.absoluteVarianceTotal) }}</span>
        <span class="card-subtitle">
          <span class="subtext-bold">1,097</span> <span class="subtext-unit">US$/ft</span>
        </span>
      </div>

      <!-- Card 4: Deviation of -->
      <div class="scorecard-card neutral-card">
        <span class="card-label">% Deviation</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <span v-else class="card-val num-font">{{ store.summaryFindings.percentageDeviationTotal }}%</span>
        <div v-if="!store.loadingDetails" class="severity-badge-container">
          <span class="severity-pill" :class="getSeverityBadgeClass(store.summaryFindings.percentageDeviationTotal)">
            {{ getSeverityLabel(store.summaryFindings.percentageDeviationTotal) }}
          </span>
        </div>          
      </div>

      <!-- Card 5: Dominant Driver -->
      <div class="scorecard-card neutral-card">
        <span class="card-label">Dominant Driver</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <template v-else>
          <span class="card-val num-font">{{ dominantDriverRatio }}%</span>
          <span class="card-subtitle">{{ dominantDriverName }}</span>
        </template>
      </div>

      <!-- Card 6: Historical Status -->
      <div class="scorecard-card neutral-card">
        <span class="card-label">Historical Status</span>
        <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
        <template v-else>
          <span class="card-val">{{ historicalStatusLabel }}</span>
          <span class="card-subtitle">Range</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'
import { useFormatters } from '~/composables/useFormatters'

const store = useVedaStore()
const { formatCurrency, getSeverityLabel, getSeverityBadgeClass } = useFormatters()

const dominantDriver = computed(() => {
  return store.componentFindings.find(c => c.isDominantDriver)
})

const dominantDriverRatio = computed(() => {
  return dominantDriver.value ? dominantDriver.value.contributionRatio : 0
})

const dominantDriverName = computed(() => {
  if (!dominantDriver.value) return 'None'
  return dominantDriver.value.costType.replace(/ (Costs|Cost)/g, '')
})

const historicalStatusLabel = computed(() => {
  if (store.computedJson?.overallSeverity === 'HIGH') return 'Unprecedented'
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
