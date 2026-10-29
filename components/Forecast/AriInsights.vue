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
          <p>Please enter comparative values in <strong>Compare Results</strong> above to generate Ari's analysis.</p>
        </div>

        <!-- Loading skeleton (only when scenario details are initially loading from database) -->
        <div v-else-if="store.loadingDetails" class="skeleton-wrapper">
          <div class="skeleton-bar animate-pulse" style="width: 100%; height: 16px;"></div>
          <div class="skeleton-bar animate-pulse" style="width: 97%; height: 16px;"></div>
          <div class="skeleton-bar animate-pulse" style="width: 94%; height: 16px;"></div>
          <div class="skeleton-bar animate-pulse" style="width: 90%; height: 16px;"></div>
          <div class="skeleton-bar animate-pulse" style="width: 55%; height: 16px;"></div>
        </div>

        <!-- Insights content: Deterministic Rule-Based Path (Non-LLM) -->
        <div v-else-if="hasComparation" class="insights-text" v-html="formattedInsights"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { usePlatformVedaStore } from '~/stores/platformVedaStore'
import { useSubseaVedaStore } from '~/stores/subseaVedaStore'
import { useFpsoVedaStore } from '~/stores/fpsoVedaStore'
import { useRoute } from 'vue-router'
import { generateRuleBasedNarrative } from '~/composables/useRuleBasedNarrative'

const route = useRoute()

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
  return store.componentFindings.length > 0 && store.componentFindings.every(c => getComparationValue(c.costType) !== null)
})

// Fully deterministic, non-LLM rule-based calculation
const ruleResult = computed(() => {
  if (!hasComparation.value) return null

  const components = store.componentFindings.map(c => ({
    costType: c.costType,
    baseline: c.baseline,
    compVal: getComparationValue(c.costType) || 0
  }))

  return generateRuleBasedNarrative(components, store.summaryFindings?.baselineTotal)
})

const formattedInsights = computed(() => {
  return ruleResult.value?.formattedHtml || ''
})

// Keep store.narrative synchronized for other consumers (e.g. PDF Export Modal)
watchEffect(() => {
  if (ruleResult.value) {
    store.narrative = ruleResult.value.plainText
    store.narrativeVerified = true
    store.loadingNarrative = false
    store.narrativeError = null
  }
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
