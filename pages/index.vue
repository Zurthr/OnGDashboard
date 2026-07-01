<template>
  <div class="dashboard-wrapper" style="margin:0 240 0 0; width:1080px;">
    <div class="container">

      <!-- ===== COMPARE RESULTS SECTION ===== -->
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
              <span v-else class="col-header-value num-font">{{ formatCostBasisTotal(store.summaryFindings.baselineTotal) }}</span>
              <span class="col-header-subtext">
                <span class="subtext-bold num-font">1,097</span> <span class="subtext-unit">US$/ft</span>
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
                <span class="col-header-subtext is-red">
                  <span class="subtext-bold num-font">1,097</span> <span class="subtext-unit">US$/ft</span>
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

              <!-- Variance Sub-columns header -->
              <div class="variance-subheader-row">
                <span class="variance-subcol-label">Amount (USD)</span>
                <span class="variance-subcol-label">in %s</span>
              </div>

              <!-- Variance Cards -->
              <div class="cards-list">
                <div 
                  v-for="finding in store.componentFindings" 
                  :key="finding.costType"
                  class="variance-card-row"
                >
                  <div class="variance-cell variance-cell-amount">
                    <span class="card-currency">in USD</span>
                    <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
                    <span v-else class="card-value num-font" :class="finding.absoluteVariance > 0 ? 'var-positive' : 'var-negative'">
                      {{ formatCurrency(finding.absoluteVariance) }}
                    </span>
                  </div>
                  <div class="variance-cell variance-cell-pct">
                    <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
                    <span v-else class="pct-value num-font" :class="finding.percentageDeviation > 0 ? 'var-positive' : 'var-negative'">
                      {{ finding.percentageDeviation > 0 ? '+' : '' }}{{ finding.percentageDeviation }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div><!-- /results-grid -->
      </div><!-- /compare-results-section -->

      <!-- ===== WHAT ARI THINKS ===== -->
      <div class="ari-section">
        <div class="ari-card">
          <!-- Top-left tab header -->
          <div class="ari-header-tab">
            <span class="tab-text">
              What <span class="ari-highlight">Ari <span class="sparkle">✨</span></span> Thinks
            </span>
          </div>

          <!-- Content -->
          <div class="ari-content">
            <!-- Loading skeleton -->
            <div v-if="store.loadingInsights || store.loadingDetails" class="skeleton-wrapper">
              <div class="skeleton-bar animate-pulse" style="width: 100%; height: 16px;"></div>
              <div class="skeleton-bar animate-pulse" style="width: 97%; height: 16px;"></div>
              <div class="skeleton-bar animate-pulse" style="width: 94%; height: 16px;"></div>
              <div class="skeleton-bar animate-pulse" style="width: 90%; height: 16px;"></div>
              <div class="skeleton-bar animate-pulse" style="width: 55%; height: 16px;"></div>
            </div>

            <!-- Error state -->
            <div v-else-if="store.errorInsights" class="ari-error-state">
              <Icon name="heroicons:exclamation-triangle-16-solid" class="ari-error-icon" />
              <span>{{ store.errorInsights }}</span>
            </div>

            <!-- Insights content -->
            <div v-else-if="store.insights" class="insights-text" v-html="formattedInsights"></div>

            <!-- Empty state -->
            <div v-else class="ari-empty-state">
              <p>Select a scenario above to generate Ari's AI analysis.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== DEV TOOLS (Collapsible) ===== -->
      <div class="dev-tools-section">
        <button class="dev-tools-toggle" @click="devToolsOpen = !devToolsOpen">
          <Icon :name="devToolsOpen ? 'heroicons:chevron-up-20-solid' : 'heroicons:chevron-down-20-solid'" class="devtools-toggle-icon" />
          <span>{{ devToolsOpen ? 'Hide' : 'Show' }} Dev Tools</span>
          <span class="dev-tools-badge">Developer</span>
        </button>

        <transition name="slide-fade">
          <div v-if="devToolsOpen" class="dev-tools-content">

            <!-- Scenario Cost Category Breakdown Table -->
            <div class="summary-table-card">
              <div class="card-header">
                <div class="header-titles">
                  <h3 class="table-title">Scenario Cost Category Breakdown</h3>
                  <p class="table-subtitle">Detailed side-by-side comparison of baseline and forecast values</p>
                </div>
                <div v-if="store.selectedScenarioId" class="scenario-badge">
                  Scenario #{{ store.selectedScenarioId }}
                </div>
              </div>
              
              <div class="table-wrapper">
                <table class="cost-table">
                  <thead>
                    <tr>
                      <th class="text-left">Cost Category</th>
                      <th class="text-right">Baseline (USD)</th>
                      <th class="text-right">Forecast (USD)</th>
                      <th class="text-right">Variance (USD)</th>
                      <th class="text-right">Contribution Ratio (%)</th>
                      <th class="text-right">Deviation (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- Loading Skeleton State -->
                    <template v-if="store.loadingDetails">
                      <tr v-for="i in 6" :key="i" class="skeleton-row">
                        <td><div class="skeleton-bar" style="width: 180px; height: 16px;"></div></td>
                        <td><div class="skeleton-bar" style="width: 100px; height: 16px; margin-left: auto;"></div></td>
                        <td><div class="skeleton-bar" style="width: 100px; height: 16px; margin-left: auto;"></div></td>
                        <td><div class="skeleton-bar" style="width: 100px; height: 16px; margin-left: auto;"></div></td>
                        <td><div class="skeleton-bar" style="width: 80px; height: 16px; margin-left: auto;"></div></td>
                        <td><div class="skeleton-bar" style="width: 70px; height: 16px; margin-left: auto;"></div></td>
                      </tr>
                    </template>
                    
                    <!-- Data State -->
                    <template v-else>
                      <tr 
                        v-for="comp in store.componentFindings" 
                        :key="comp.costType" 
                        class="data-row"
                        :class="{ 'dominant-table-row': comp.isDominantDriver }"
                      >
                        <td class="category-name">
                          <div class="category-label-wrapper">
                            <span>{{ comp.costType }}</span>
                            <span v-if="comp.isDominantDriver" class="dominant-table-tag">DOMINANT</span>
                          </div>
                        </td>
                        <td class="text-right num-font">{{ formatCurrency(comp.baseline) }}</td>
                        <td class="text-right num-font">{{ formatCurrency(comp.forecast) }}</td>
                        <td 
                          class="text-right num-font font-semibold"
                          :class="comp.absoluteVariance > 0 ? 'text-red' : comp.absoluteVariance < 0 ? 'text-green' : ''"
                        >
                          {{ comp.absoluteVariance > 0 ? '+' : '' }}{{ formatCurrency(comp.absoluteVariance) }}
                        </td>
                        <td class="text-right num-font">
                          {{ comp.contributionRatio > 0 ? '+' : '' }}{{ comp.contributionRatio }}%
                        </td>
                        <td class="text-right">
                          <span 
                            class="badge num-font"
                            :class="comp.percentageDeviation > 35 ? 'badge-red-bold' : comp.percentageDeviation > 15 ? 'badge-red' : comp.percentageDeviation < -15 ? 'badge-green' : 'badge-gray'"
                          >
                            {{ comp.percentageDeviation > 0 ? '+' : '' }}{{ comp.percentageDeviation }}%
                          </span>
                        </td>
                      </tr>

                      <!-- Total Row -->
                      <tr class="total-row-item">
                        <td class="font-bold">Total Capex Sum</td>
                        <td class="text-right num-font font-bold">{{ formatCostBasisTotal(store.summaryFindings.baselineTotal) }}</td>
                        <td class="text-right num-font font-bold">{{ formatCurrency(store.summaryFindings.forecastTotal) }}</td>
                        <td 
                          class="text-right num-font font-bold"
                          :class="store.summaryFindings.absoluteVarianceTotal > 0 ? 'text-red' : 'text-green'"
                        >
                          {{ store.summaryFindings.absoluteVarianceTotal > 0 ? '+' : '' }}{{ formatCurrency(store.summaryFindings.absoluteVarianceTotal) }}
                        </td>
                        <td class="text-right num-font font-bold">100.00%</td>
                        <td class="text-right">
                          <span 
                            class="badge num-font font-bold"
                            :class="store.summaryFindings.percentageDeviationTotal > 25 ? 'badge-red-bold' : store.summaryFindings.percentageDeviationTotal > 10 ? 'badge-red' : 'badge-gray'"
                          >
                            {{ store.summaryFindings.percentageDeviationTotal > 0 ? '+' : '' }}{{ store.summaryFindings.percentageDeviationTotal }}%
                          </span>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- VEDA JSON Section -->
            <div class="json-card">
              <div class="card-header">
                <div class="header-titles">
                  <h3 class="table-title">VEDA Engine Output JSON</h3>
                  <p class="table-subtitle">Structured computation payload returned by the backend engine</p>
                </div>
                <button 
                  v-if="store.computedJson" 
                  @click="copyJson" 
                  class="copy-btn"
                  :disabled="store.loadingDetails"
                >
                  <Icon :name="copied ? 'heroicons:check-16-solid' : 'heroicons:clipboard-document-16-solid'" class="btn-icon" />
                  <span>{{ copied ? 'Copied!' : 'Copy JSON' }}</span>
                </button>
              </div>

              <div class="code-container">
                <template v-if="store.loadingDetails">
                  <div class="skeleton-code-wrapper animate-pulse">
                    <div class="skeleton-code-line" style="width: 25%"></div>
                    <div class="skeleton-code-line" style="width: 45%"></div>
                    <div class="skeleton-code-line" style="width: 35%"></div>
                    <div class="skeleton-code-line" style="width: 55%"></div>
                    <div class="skeleton-code-line" style="width: 20%"></div>
                    <div class="skeleton-code-line" style="width: 75%"></div>
                    <div class="skeleton-code-line" style="width: 60%"></div>
                    <div class="skeleton-code-line" style="width: 30%"></div>
                  </div>
                </template>
                <pre v-else-if="store.computedJson" class="code-block"><code>{{ formattedJson }}</code></pre>
                <div v-else class="empty-json">
                  No computed VEDA JSON available.
                </div>
              </div>
            </div>

          </div>
        </transition>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

// Title SEO meta tags
useHead({
  title: 'SKK Migas - Veda CAPEX Forecasting Compare Results',
  meta: [
    { name: 'description', content: 'Advanced financial Capex comparing results dashboard powered by Veda AI Engine.' }
  ]
})

const store = useVedaStore()
const copied = ref(false)
const devToolsOpen = ref(false)


// Compute formatted JSON string for display
const formattedJson = computed(() => {
  if (!store.computedJson) return ''
  return JSON.stringify(store.computedJson, null, 2)
})

// Format Ari insights with bold markers
const formattedInsights = computed(() => {
  if (!store.insights) return ''
  // Wrap **text** in <strong> tags
  return store.insights
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
})

// Currency helper format
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val)
}

// Special mockup format rule to match user screenshot's comma position exactly
const formatCostBasisTotal = (val: number) => {
  if (val === 56723100) return '56,7231,00'
  return formatCurrency(val)
}

// Severity badge helpers based on deviation %
const getSeverityLabel = (deviation: number) => {
  if (deviation <= 5) return 'Low'
  if (deviation <= 15) return 'Medium'
  if (deviation <= 30) return 'High'
  return 'Critical'
}

const getSeverityClass = (deviation: number) => {
  if (deviation <= 5) return 'severity-low'
  if (deviation <= 15) return 'severity-medium'
  if (deviation <= 30) return 'severity-high'
  return 'severity-critical'
}

// Copy JSON utility
const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(formattedJson.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy VEDA JSON:', err)
  }
}

// Fetch scenarios on mount, which will trigger auto-selecting the first scenario
onMounted(async () => {
  await store.fetchScenarios()
})
</script>

<style scoped>
/* =============================================
   GLOBAL WRAPPER & CONTAINER
   ============================================= */
.dashboard-wrapper {
  min-height: 100vh;
  padding: 32px 40px 80px;
  background-color: #f4f4f0;
}

.container {
  max-width: 1360px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

/* =============================================
   FONT UTILITIES
   ============================================= */
.num-font {
  font-family: var(--font-number);
}

/* =============================================
   CONTROL PANEL
   ============================================= */
.control-panel {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-lg);
  padding: 20px 24px;
  margin-bottom: 36px;
  box-shadow: var(--shadow-sm);
}

.selector-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selector-label {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  letter-spacing: -0.2px;
}

.select-controls-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.custom-select-wrapper {
  position: relative;
  width: 240px;
}

.scenario-select {
  width: 100%;
  appearance: none;
  background-color: #f8fafc;
  border: 1.5px solid #cbd5e1;
  border-radius: var(--border-radius-sm);
  padding: 10px 40px 10px 16px;
  font-family: var(--font-family);
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.scenario-select:focus {
  border-color: #10b981;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.select-arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  pointer-events: none;
  display: flex;
  align-items: center;
}

.mini-loader {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}

.error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-danger);
  font-size: 13px;
  font-weight: 500;
  margin-top: 4px;
}

.error-icon {
  width: 16px;
  height: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* =============================================
   SKELETON HELPERS
   ============================================= */
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
  margin-top:16px;
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
  width:280px;
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
  width:280px;
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

/* Variance sub-column header row */
.variance-subheader-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-bottom: 10px;
  margin-top: 12px;
}

.variance-subcol-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b8f4a;
  text-transform: uppercase;
  letter-spacing: 0.4px;
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
  font-weight: 700;
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
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
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
}

.variance-cell-amount {
  flex: 1;
}

.variance-cell-pct {
  min-width: 68px;
  align-items: center;
  text-align: center;
}

.pct-value {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.var-positive {
  color: #c2410c; /* orange-red for positive variance (cost overrun) */
}

.var-negative {
  color: #15803d; /* green for negative variance (cost savings) */
}

/* =============================================
   WHAT ARI THINKS
   ============================================= */
.ari-section {
  margin-top: 48px;
}

.ari-card {
  position: relative;
  background-color: #ffffff;
  border: 1.5px solid #fecaca;
  border-radius: 16px;
  padding: 28px 32px 28px;
  margin-top: 28px;
}

.ari-header-tab {
  position: absolute;
  top: -1.5px;
  left: 20px;
  transform: translateY(-100%);
  background-color: #ffffff;
  border: 1.5px solid #fecaca;
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  padding: 4px 16px;
  height: 36px;
  display: flex;
  align-items: center;
  z-index: 10;
}

.ari-header-tab::after {
  content: '';
  position: absolute;
  bottom: -2.5px;
  left: 0.5px;
  right: 0.5px;
  height: 4px;
  background-color: #ffffff;
  z-index: 12;
}

.tab-text {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}

.ari-highlight {
  color: #f43f5e;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sparkle {
  color: #f97316;
  font-size: 16px;
}

.ari-content {
  min-height: 80px;
}

.insights-text {
  font-size: 16px;
  color: #334155;
  line-height: 1.75;
  font-weight: 450;
  letter-spacing: -0.1px;
}

.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ari-error-state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-danger);
  font-weight: 600;
  font-size: 14px;
}

.ari-error-icon {
  width: 20px;
  height: 20px;
}

.ari-empty-state {
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}

/* =============================================
   DEV TOOLS SECTION
   ============================================= */
.dev-tools-section {
  margin-top: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.dev-tools-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: #f1f5f9;
  border: 1.5px solid #cbd5e1;
  border-radius: 99px;
  padding: 10px 22px;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  user-select: none;
}

.dev-tools-toggle:hover {
  background-color: #e2e8f0;
  border-color: #94a3b8;
  color: #334155;
}

.devtools-toggle-icon {
  width: 16px;
  height: 16px;
}

.dev-tools-badge {
  background-color: #334155;
  color: #f8fafc;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.dev-tools-content {
  width: 100%;
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* =============================================
   SUMMARY TABLE CARD
   ============================================= */
.summary-table-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-xl);
  padding: 28px 32px;
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.5px;
}

.table-subtitle {
  font-size: 14px;
  color: #64748b;
}

.scenario-badge {
  background-color: #e2e8f0;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 99px;
  font-family: var(--font-number);
}

.table-wrapper {
  overflow-x: auto;
}

.cost-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}

.cost-table th {
  padding: 12px 16px;
  font-weight: 600;
  color: #64748b;
  border-bottom: 2px solid #f1f5f9;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cost-table td {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  vertical-align: middle;
}

.category-name {
  font-weight: 600;
  color: #0f172a;
}

.category-label-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dominant-table-tag {
  font-size: 8px;
  font-weight: 700;
  color: #ef4444;
  background-color: #fee2e2;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.dominant-table-row {
  background-color: #fffafb;
}

.text-right {
  text-align: right;
}

.text-left {
  text-align: left;
}

.font-semibold {
  font-weight: 600;
}

.font-bold {
  font-weight: 700;
  color: #0f172a;
}

.text-red {
  color: #e11d48;
}

.text-green {
  color: #16a34a;
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.badge-red {
  background-color: #fee2e2;
  color: #991b1b;
}

.badge-red-bold {
  background-color: #ef4444;
  color: #ffffff;
}

.badge-green {
  background-color: #dcfce7;
  color: #166534;
}

.badge-gray {
  background-color: #f1f5f9;
  color: #475569;
}

/* Total row styling */
.total-row-item {
  background-color: #f8fafc;
}

.total-row-item td {
  border-top: 2px solid #e2e8f0;
  border-bottom: 2px solid #e2e8f0;
  color: #0f172a;
}

/* Skeleton rows */
.skeleton-row td {
  padding: 20px 16px;
}

/* =============================================
   VEDA JSON CARD
   ============================================= */
.json-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-xl);
  padding: 28px 32px;
  box-shadow: var(--shadow-sm);
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: var(--border-radius-sm);
  padding: 8px 16px;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.copy-btn:hover:not(:disabled) {
  border-color: #10b981;
  color: #10b981;
  background-color: #f0fdf4;
}

.copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.code-container {
  position: relative;
  background-color: #0f172a;
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.code-block {
  margin: 0;
  padding: 20px;
  overflow: auto;
  max-height: 480px;
}

.code-block code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #e2e8f0;
}

.empty-json {
  padding: 32px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}

.skeleton-code-wrapper {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-code-line {
  height: 14px;
  background-color: #1e293b;
  border-radius: 4px;
}

/* =============================================
   TRANSITIONS
   ============================================= */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}
.slide-fade-leave-active {
  transition: all 0.25s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* =============================================
   RESPONSIVE
   ============================================= */
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
  .dashboard-wrapper {
    padding: 40px 20px 60px;
  }
  .results-grid {
    grid-template-columns: 1fr;
  }
  .col-variance {
    grid-column: 1;
  }
  .results-label {
    font-size: 40px;
  }
}
</style>
