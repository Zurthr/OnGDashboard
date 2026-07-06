<template>
  <div class="compare-results-section">
    <!-- Row 0: Section Label -->
    <div class="section-label-row">
      <div class="section-label-block">
        <span class="compare-label">Compare</span>
        <h1 class="results-label">Results</h1>
      </div>
    </div>

    <!-- 3-column grid: Cost Basis | Forecasted | Variance -->
    <div class="results-grid">

      <!-- COL 1: Cost Basis -->
      <div class="col-basis">
        <div class="col-header-block">
          <span class="col-header-label">Cost Basis</span>
          <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
          <span v-else class="col-header-value num-font">{{ formatCurrency(store.summaryFindings.baselineTotal) }}</span>
          <span v-if="!store.loadingDetails" class="col-header-subtext">
            <span class="subtext-bold num-font">{{ baselineCostPerFoot }}</span> <span class="subtext-unit">US$/ft</span>
          </span>
        </div>

        <!-- Basis Cards -->
        <div class="cards-list">
          <div 
            v-for="finding in store.componentFindings" 
            :key="finding.costType" 
            class="basis-card"
            :class="{ 'dominant-card': finding.isDominantDriver }"
          >
            <div class="card-left">
              <span class="card-prefix">
                Total <span v-if="finding.isDominantDriver" class="dominant-prefix">• Dominant</span>
              </span>
              <span class="card-name">{{ finding.costType }}</span>
            </div>
            <div class="card-divider"></div>
            <div class="card-right">
              <span class="card-currency">in USD</span>
              <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
              <span v-else class="card-value num-font">{{ formatCurrency(finding.baseline) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- COL 2: Forecasted (red tinted) -->
      <div class="col-forecast">
        <div class="forecast-inner">
          <div class="col-header-block">
            <span class="col-header-label">Forecasted</span>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
            <span v-else class="col-header-value num-font forecast-value-color">{{ formatCurrency(store.summaryFindings.forecastTotal) }}</span>
            <span v-if="!store.loadingDetails" class="col-header-subtext is-red">
              <span class="subtext-bold num-font">{{ forecastCostPerFoot }}</span> <span class="subtext-unit">US$/ft</span>
            </span>
          </div>

          <!-- Forecast Cards -->
          <div class="cards-list">
            <div 
              v-for="finding in store.componentFindings" 
              :key="finding.costType" 
              class="forecast-card"
              :class="{ 'dominant-forecast-card': finding.isDominantDriver }"
            >
              <div class="card-badge-row">
                <span class="card-currency">in USD</span>
                <span v-if="finding.isDominantDriver" class="dominant-tag">DOMINANT DRIVER</span>
              </div>
              <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
              <span v-else class="card-value num-font">{{ formatCurrency(finding.forecast) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- COL 3: Variance (green dashed border) -->
      <div class="col-variance">
        <div class="variance-inner">
          <!-- Variance Header -->
          <div class="variance-header-row">
            <span class="col-header-label variance-label-text">Variance</span>
            <span class="severity-badge" :class="getSeverityClass(store.summaryFindings.percentageDeviationTotal)">
              {{ getSeverityLabel(store.summaryFindings.percentageDeviationTotal) }}
            </span>
          </div>
          <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
          <span v-else class="col-header-value num-font variance-value-color">{{ formatCurrency(store.summaryFindings.absoluteVarianceTotal) }}</span>
          <span v-if="!store.loadingDetails" class="col-header-subtext variance-subtext">
            <span class="subtext-bold num-font">{{ varianceCostPerFoot }}</span> <span class="subtext-unit">US$/ft</span>
          </span>

          <!-- Variance Cards -->
          <div class="cards-list">
            <div 
              v-for="finding in store.componentFindings" 
              :key="finding.costType"
              class="variance-card-row"
            >
              <div class="variance-cell">
                <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
                <div v-else class="variance-cell-inner">
                  <span
                    class="card-value num-font"
                    :class="finding.absoluteVariance > 0 ? 'var-positive' : 'var-negative'"
                  >
                    {{ formatCurrency(finding.absoluteVariance) }}
                  </span>
                  <span
                    class="card-value num-font"
                    :class="finding.percentageDeviation > 0 ? 'var-positive' : 'var-negative'"
                  >
                    {{ finding.percentageDeviation > 0 ? '+' : '' }}{{ finding.percentageDeviation }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'
import { useFormatters } from '~/composables/useFormatters'

const store = useVedaStore()
const { formatCurrency, formatCostPerFoot, getSeverityClass, getSeverityLabel } = useFormatters()

const pipeLength = computed(() => store.navParams.pipeLength)

const baselineCostPerFoot = computed(() =>
  formatCostPerFoot(store.summaryFindings.baselineTotal, pipeLength.value)
)

const forecastCostPerFoot = computed(() =>
  formatCostPerFoot(store.summaryFindings.forecastTotal, pipeLength.value)
)

const varianceCostPerFoot = computed(() =>
  formatCostPerFoot(store.summaryFindings.absoluteVarianceTotal, pipeLength.value)
)
</script>

<style scoped>
/* =============================================
   COMPARE RESULTS SECTION
   ============================================= */
.compare-results-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-label-row {
  display: flex;
  align-items: flex-end;
}

.section-label-block {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.compare-label {
  font-size: 30px;
  font-weight: 400;
  color: #0f172a;
  letter-spacing: -0.5px;
}

.results-label {
  font-size: 54px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
  letter-spacing: -2px;
  margin: 0;
}

/* =============================================
   3-COLUMN RESULTS GRID
   ============================================= */
.results-grid {
  display: flex;
  flex-direction: row;
  gap: 24px;
  align-items: start;
}

/* =============================================
   SHARED COLUMN HEADER BLOCK
   ============================================= */
.col-header-block {
  display: flex;
  flex-direction: column;
  margin-bottom: 18px;
}

.col-header-label {
  font-size: 22px;
  font-weight: 400;
  color: #475569;
  margin-bottom: 2px;
}

.col-header-value {
  font-size: 32px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1;
  letter-spacing: -1.5px;
}

.forecast-value-color {
  color: #0f172a;
}

.col-header-subtext {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-top: 6px;
}

.col-header-subtext.is-red {
  color: #f43f5e;
}

.col-header-subtext.variance-subtext {
  color: #6b8f4a;
}

.subtext-bold {
  font-weight: 700;
  color: inherit;
}

.subtext-unit {
  font-weight: 400;
  opacity: 0.85;
}

/* =============================================
   COL 1: COST BASIS
   ============================================= */
.col-basis {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  width: fit-content;
}

/* =============================================
   COL 2: FORECASTED (pink bg container)
   ============================================= */
.col-forecast {
  display: flex;
  flex-direction: column;
  width: fit-content;
}

.forecast-inner {
  background-color: #fdf0f0;
  border-radius: var(--border-radius-xl);
  padding: 16px;
  display: flex;
  flex-direction: column;
  width: 280px;
}

/* =============================================
   COL 3: VARIANCE (green dashed border)
   ============================================= */
.col-variance {
  display: flex;
  flex-direction: column;
  width: fit-content;
}

.variance-inner {
  background-color: #f6fbee;
  border: 2px dashed #a3c96c;
  border-radius: var(--border-radius-xl);
  padding: 16px;
  display: flex;
  flex-direction: column;
  width: 280px;
}

.variance-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.variance-label-text {
  color: #3a5c20;
}

/* Severity Badge */
.severity-badge {
  font-size: 11px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 99px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.severity-low {
  background-color: #84cc16;
  color: #ffffff;
}

.severity-medium {
  background-color: #f59e0b;
  color: #ffffff;
}

.severity-high {
  background-color: #ef4444;
  color: #ffffff;
}

.severity-critical {
  background-color: #7f1d1d;
  color: #ffffff;
}

.variance-value-color {
  color: #3a5c20;
}

/* =============================================
   CARDS LIST (shared)
   ============================================= */
.cards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* =============================================
   BASIS CARDS
   ============================================= */
.basis-card {
  background-color: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: var(--border-radius-md);
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.basis-card.dominant-card {
  border-color: #fca5a5;
}

.card-left {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-prefix {
  font-size: 9px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
}

.dominant-prefix {
  color: #ef4444;
}

.card-name {
  font-size: 14px;
  font-weight: 500;
  color: #0f172a;
  line-height: 1.3;
}

.card-divider {
  width: 2px;
  height: 36px;
  background-color: #84cc16;
  margin: 0 18px;
  border-radius: 99px;
  flex-shrink: 0;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 100px;
}

.card-currency {
  font-size: 10px;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 2px;
}

.card-value {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.5px;
}

/* =============================================
   FORECAST CARDS
   ============================================= */
.forecast-card {
  background-color: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: var(--border-radius-md);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 76px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  transition: border-color 0.2s;
}

.forecast-card.dominant-forecast-card {
  border-color: #fca5a5;
  border-style: dashed;
}

.card-badge-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.dominant-tag {
  font-size: 8px;
  font-weight: 700;
  color: #ef4444;
  background-color: #fee2e2;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

/* =============================================
   VARIANCE CARDS
   ============================================= */
.variance-card-row {
  min-height: 76px;
}

.variance-cell {
  background-color: #ffffff;
  border: 1px solid #d4e8b0;
  border-radius: var(--border-radius-md);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 76px;
}

.variance-cell-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.var-positive {
  color: #c2410c;
}

.var-negative {
  color: #15803d;
}

.header-skeleton {
  width: 200px;
  height: 48px;
  border-radius: var(--border-radius-sm);
  margin: 4px 0;
}

.card-value-skeleton {
  width: 100px;
  height: 24px;
  border-radius: var(--border-radius-sm);
}

.num-font {
  font-family: var(--font-number);
}

@media (max-width: 1100px) {
  .results-grid {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .col-variance {
    grid-column: 1 / span 2;
  }
}

@media (max-width: 768px) {
  .results-grid {
    grid-template-columns: 1fr;
  }
  .col-variance {
    grid-column: 1;
  }
}
</style>
