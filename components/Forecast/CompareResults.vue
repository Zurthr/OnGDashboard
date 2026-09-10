<template>
  <div class="compare-results-section">
    <!-- 3-column grid: Cost Basis | Comparation | Variance -->
    <div class="results-grid">

      <!-- COL 1: Cost Basis -->
      <div class="col-basis">
        <div style="display: flex; flex-direction: row; gap: 52px;">
          <div class="section-label-block">
            <span class="compare-label">Compare</span>
            <h1 class="results-label">Results</h1>
          </div>
          <div class="col-header-block">
            <span class="col-header-label">Cost Basis</span>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
            <span v-else class="col-header-value num-font">{{ formatCurrency(store.summaryFindings.baselineTotal) }}</span>
            <span v-if="!store.loadingDetails" class="col-header-subtext">
              <span class="subtext-bold num-font">{{ baselineCostPerFoot }}</span> <span class="subtext-unit">US$/ft</span>
            </span>
          </div>
        </div>

        <!-- Basis Cards -->
        <div class="cards-list">
          <div 
            v-for="finding in store.componentFindings" 
            :key="finding.costType" 
            class="basis-card"
            :class="{ 'dominant-card': hasComparation && finding.isDominantDriver }"
          >
            <div class="card-left">
              <span class="card-prefix">
                Total <span v-if="hasComparation && finding.isDominantDriver" class="dominant-prefix">• Dominant</span>
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

      <!-- COL 2: Comparation (pink bg container) - Clickable to open Modal -->
      <div class="col-forecast">
        <div class="forecast-inner clickable-forecast" @click="openModal" title="Click to enter/edit Comparation values">
          <div class="col-header-block">
            <div class="header-label-row">
              <span class="col-header-label">Comparation</span>
              <button class="btn-edit-inline" @click.stop="openModal">✏️ Input</button>
            </div>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
            <span v-else class="col-header-value num-font forecast-value-color">
              {{ hasComparation ? formatCurrency(comparationTotal) : '-' }}
            </span>
            <span v-if="!store.loadingDetails" class="col-header-subtext is-red">
              <span class="subtext-bold num-font">{{ hasComparation ? comparationCostPerFoot : '-' }}</span>
              <span class="subtext-unit"> US$/ft</span>
            </span>
          </div>

          <!-- Forecast Cards -->
          <div class="cards-list">
            <div 
              v-for="finding in store.componentFindings" 
              :key="finding.costType" 
              class="forecast-card"
              :class="{ 'dominant-forecast-card': hasComparation && finding.isDominantDriver }"
            >
              <div class="card-badge-row">
                <span class="card-currency">in USD</span>
                <span v-if="hasComparation && finding.isDominantDriver" class="dominant-tag">DOMINANT DRIVER</span>
              </div>
              <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
              <span v-else class="card-value num-font">
                {{ getComparationValue(finding.costType) !== null ? formatCurrency(getComparationValue(finding.costType)!) : '-' }}
              </span>
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
            <span 
              v-if="hasComparation" 
              class="severity-badge" 
              :class="getSeverityClass(percentageDeviationTotal)"
            >
              {{ getSeverityLabel(percentageDeviationTotal) }}
            </span>
          </div>
          <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
          <span v-else class="col-header-value num-font variance-value-color">
            {{ hasComparation ? formatCurrency(varianceTotal) : '-' }}
          </span>
          <span v-if="!store.loadingDetails" class="col-header-subtext variance-subtext">
            <span class="subtext-bold num-font">{{ hasComparation ? varianceCostPerFoot : '-' }}</span>
            <span class="subtext-unit"> US$/ft</span>
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
                <div v-else-if="hasComparation" class="variance-cell-inner">
                  <span
                    class="card-value num-font"
                    :class="getAbsoluteVariance(finding) > 0 ? 'var-positive' : 'var-negative'"
                  >
                    {{ formatCurrency(getAbsoluteVariance(finding)) }}
                  </span>
                  <span
                    class="card-value num-font"
                    :class="getPercentageDeviation(finding) > 0 ? 'var-positive' : 'var-negative'"
                  >
                    {{ getPercentageDeviation(finding) > 0 ? '+' : '' }}{{ getPercentageDeviation(finding) }}%
                  </span>
                </div>
                <div v-else class="variance-cell-inner">
                  <span class="card-value num-font text-muted">-</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- COMPARATION INPUT MODAL -->
    <Transition name="modal">
      <div v-if="store.isComparationModalOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Input Comparation Values</h3>
              <p class="modal-subtitle">Enter budget or actual values to analyze variance against Cost Basis</p>
            </div>
            <button class="modal-close-btn" @click="closeModal">&times;</button>
          </div>

          <div class="modal-body">
            <div 
              v-for="finding in store.componentFindings" 
              :key="finding.costType" 
              class="modal-input-row"
            >
              <div class="input-info">
                <span class="input-label">{{ finding.costType }}</span>
                <span class="input-basis-hint">Basis: {{ formatCurrency(finding.baseline) }} USD</span>
              </div>
              <div class="input-wrapper">
                <span class="input-prefix">$</span>
                <input
                  v-model.number="localInputs[finding.costType]"
                  type="number"
                  class="modal-input num-font"
                  placeholder="Enter amount..."
                  min="0"
                  @keydown.e.prevent
                  @keydown.-.prevent
                />
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="closeModal">Cancel</button>
            <button class="btn-primary" @click="saveComparation">Save Comparation</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'
import { usePlatformVedaStore } from '~/stores/platformVedaStore'
import { useSubseaVedaStore } from '~/stores/subseaVedaStore'
import { useFpsoVedaStore } from '~/stores/fpsoVedaStore'
import { useRoute } from 'vue-router'
import { useFormatters } from '~/composables/useFormatters'

const route = useRoute()
const { formatCurrency, formatCostPerFoot, getSeverityClass, getSeverityLabel } = useFormatters()

const store = computed(() => {
  if (route.path.startsWith('/platform')) return usePlatformVedaStore()
  if (route.path.startsWith('/subsea')) return useSubseaVedaStore()
  if (route.path.startsWith('/fpso')) return useFpsoVedaStore()
  return useVedaStore()
}).value

const pipeLength = computed(() => store.navParams.pipeLength)

const localInputs = reactive<Record<string, number | null>>({})

const openModal = () => {
  store.componentFindings.forEach(c => {
    localInputs[c.costType] = store.comparationInputs[c.costType] ?? null
  })
  store.openComparationModal()
}

const closeModal = () => {
  store.closeComparationModal()
}

const saveComparation = () => {
  store.setComparationInputs({ ...localInputs })
  store.closeComparationModal()
}

const getComparationValue = (costType: string): number | null => {
  const val = store.comparationInputs[costType]
  if (val === undefined || val === null || (val as any) === '') return null
  return Number(val)
}

const hasComparation = computed(() => {
  const keys = Object.keys(store.comparationInputs || {})
  if (keys.length === 0) return false
  return store.componentFindings.every(c => getComparationValue(c.costType) !== null)
})

const comparationTotal = computed(() => {
  if (!hasComparation.value) return 0
  return store.componentFindings.reduce((sum, c) => {
    return sum + (getComparationValue(c.costType) || 0)
  }, 0)
})

const varianceTotal = computed(() => {
  if (!hasComparation.value) return 0
  return comparationTotal.value - store.summaryFindings.baselineTotal
})

const percentageDeviationTotal = computed(() => {
  if (!hasComparation.value || store.summaryFindings.baselineTotal === 0) return 0
  return Number(((varianceTotal.value / store.summaryFindings.baselineTotal) * 100).toFixed(2))
})

const getAbsoluteVariance = (finding: any) => {
  const val = getComparationValue(finding.costType)
  if (val === null) return 0
  return val - finding.baseline
}

const getPercentageDeviation = (finding: any) => {
  const val = getComparationValue(finding.costType)
  if (val === null || finding.baseline === 0) return 0
  const abs = val - finding.baseline
  return Number(((abs / finding.baseline) * 100).toFixed(2))
}

const baselineCostPerFoot = computed(() =>
  formatCostPerFoot(store.summaryFindings.baselineTotal, pipeLength.value)
)

const comparationCostPerFoot = computed(() =>
  formatCostPerFoot(comparationTotal.value, pipeLength.value)
)

const varianceCostPerFoot = computed(() =>
  formatCostPerFoot(varianceTotal.value, pipeLength.value)
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

.header-label-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-edit-inline {
  font-size: 11px;
  font-weight: 600;
  color: #e11d48;
  background-color: #ffe4e6;
  border: 1px solid #fecaca;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-edit-inline:hover {
  background-color: #f43f5e;
  color: #ffffff;
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
   COL 2: COMPARATION (pink bg container)
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
  transition: box-shadow 0.2s, border-color 0.2s;
}

.clickable-forecast {
  cursor: pointer;
}

.clickable-forecast:hover {
  box-shadow: 0 4px 16px rgba(244, 63, 94, 0.15);
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
  min-width: 180px;
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

.text-muted {
  color: #94a3b8;
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

/* =============================================
   MODAL STYLES
   ============================================= */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-card {
  background-color: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.modal-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
}

.modal-close-btn:hover {
  color: #0f172a;
}

.modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.modal-input-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.input-info {
  display: flex;
  flex-direction: column;
}

.input-label {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.input-basis-hint {
  font-size: 11px;
  color: #94a3b8;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-prefix {
  position: absolute;
  left: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
}

.modal-input {
  width: 180px;
  padding: 8px 12px 8px 26px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.modal-input:focus {
  border-color: #e11d48;
  box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.15);
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background-color: #f8fafc;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background-color: #ffffff;
  color: #475569;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary:hover {
  background-color: #f1f5f9;
}

.btn-primary {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background-color: #e11d48;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.btn-primary:hover {
  background-color: #be123c;
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
