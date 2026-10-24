<template>
  <div class="ari-section">
    <div class="ari-card">
      <!-- Top-left tab header -->
      <div class="ari-header-tab">
        <span class="tab-text">
          <img src="assets\icons\Ari.png" alt="Ari" style="height:32px; margin-top:12px">
        </span>
      </div>

      <!-- Content -->
      <div class="ari-content">
        <!-- Waiting for input state -->
        <div v-if="!hasComparation" class="ari-empty-state">
          <Icon name="heroicons:information-circle-20-solid" class="empty-info-icon" />
          <p>Please enter comparative values in <strong>Compare Results</strong> above to generate Ari's AI analysis.</p>
        </div>

        <!-- Loading skeleton -->
        <div v-else-if="store.loadingNarrative || store.loadingDetails" class="skeleton-wrapper">
          <div class="skeleton-bar animate-pulse" style="width: 100%; height: 16px;"></div>
          <div class="skeleton-bar animate-pulse" style="width: 97%; height: 16px;"></div>
          <div class="skeleton-bar animate-pulse" style="width: 94%; height: 16px;"></div>
          <div class="skeleton-bar animate-pulse" style="width: 90%; height: 16px;"></div>
          <div class="skeleton-bar animate-pulse" style="width: 55%; height: 16px;"></div>
        </div>

        <!-- Error state -->
        <div v-else-if="store.narrativeError" class="ari-error-state">
          <Icon name="heroicons:exclamation-triangle-16-solid" class="ari-error-icon" />
          <span>{{ store.narrativeError }}</span>
        </div>

        <!-- Insights content -->
        <div v-else-if="hasComparation" class="insights-text" v-html="formattedInsights"></div>
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

const route = useRoute()
const { formatCurrency, getSeverityLabel } = useFormatters()

const store = computed(() => {
  if (route.path.startsWith('/subsea')) return useSubseaVedaStore()
  if (route.path.startsWith('/fpso')) return useFpsoVedaStore()
  return usePlatformVedaStore()
}).value

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
  return store.componentFindings.reduce((sum, c) => sum + (getComparationValue(c.costType) || 0), 0)
})

const varianceTotal = computed(() => {
  if (!hasComparation.value) return 0
  return comparationTotal.value - store.summaryFindings.baselineTotal
})

const percentageDeviation = computed(() => {
  if (!hasComparation.value || store.summaryFindings.baselineTotal === 0) return 0
  return Number(((varianceTotal.value / store.summaryFindings.baselineTotal) * 100).toFixed(2))
})

// Format Ari insights dynamically based on the input values
const formattedInsights = computed(() => {
  if (!hasComparation.value) return ''

  if (store.narrative) {
    return store.narrative
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
  }

  const compTotalStr = formatCurrency(comparationTotal.value)
  const baseTotalStr = formatCurrency(store.summaryFindings.baselineTotal)
  const varTotalStr = formatCurrency(Math.abs(varianceTotal.value))
  const pctStr = Math.abs(percentageDeviation.value).toFixed(2)
  const isExceed = varianceTotal.value >= 0
  const severityLabel = getSeverityLabel(percentageDeviation.value).toUpperCase()

  // Find dominant driver based on inputs
  const sortedComponents = store.componentFindings.map(c => {
    const compVal = getComparationValue(c.costType) || 0
    const varVal = compVal - c.baseline
    const pct = c.baseline === 0 ? 0 : (varVal / c.baseline) * 100
    return {
      costType: c.costType,
      baseline: c.baseline,
      compVal,
      varVal,
      pct,
      absVar: Math.abs(varVal)
    }
  }).sort((a, b) => b.absVar - a.absVar)

  const topDriver = sortedComponents[0]
  const topDriverName = topDriver ? topDriver.costType : 'Pipeline Costs'
  const topDriverVarStr = topDriver ? formatCurrency(Math.abs(topDriver.varVal)) : '$0'
  const topDriverPctStr = topDriver ? Math.abs(topDriver.pct).toFixed(2) : '0.00'

  const paragraph1 = `Total proposed cost of ${compTotalStr} ${isExceed ? 'exceeds' : 'is below'} the approved baseline of ${baseTotalStr}, reflecting an aggregate deviation of ${varTotalStr} or ${pctStr}% at a ${severityLabel} severity level. ${topDriverName} is identified as the key cost driver with a variance of ${topDriverVarStr} or ${topDriverPctStr}% ${topDriver.varVal >= 0 ? 'above' : 'below'} its baseline.`

  const otherItemsStr = sortedComponents.slice(1).map(c => {
    const sign = c.varVal >= 0 ? '+' : '-'
    return `${c.costType} (${sign}${Math.abs(c.pct).toFixed(2)}%)`
  }).join(', ')

  const paragraph2 = `All other cost components, namely ${otherItemsStr}, show reasonable deviations. The regulator is advised to review justification for major variances prior to final approval.`

  return `${paragraph1}<br><br>${paragraph2}`
})
</script>

<style scoped>
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
  color: #64748b;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
}

.empty-info-icon {
  width: 20px;
  height: 20px;
  color: #f43f5e;
}
</style>
