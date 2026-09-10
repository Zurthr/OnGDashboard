<template>
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
                    <td class="text-right num-font font-bold">{{ formatCurrency(store.summaryFindings.baselineTotal) }}</td>
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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'
import { useFormatters } from '~/composables/useFormatters'

const store = useVedaStore()
const { formatCurrency } = useFormatters()

const devToolsOpen = ref(false)
const copied = ref(false)

const formattedJson = computed(() => {
  if (!store.computedJson) return ''
  return JSON.stringify(store.computedJson, null, 2)
})

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
</script>

<style scoped>
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

.num-font {
  font-family: var(--font-number);
}
</style>
