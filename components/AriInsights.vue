<template>
  <div class="ari-card">
    <!-- Custom Top-Left Header Tab -->
    <div class="ari-header-tab">
      <span class="tab-text">
        <img src="assets\icons\Ari.png" alt="Ari" style="height:32px; margin-top:12px">
      </span>
    </div>

    <!-- Insights Content Box -->
    <div class="ari-content">
      <!-- Loading Skeleton State -->
      <div v-if="isLoading" class="skeleton-wrapper">
        <div class="skeleton-bar line-1"></div>
        <div class="skeleton-bar line-2"></div>
        <div class="skeleton-bar line-3"></div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state">
        <Icon name="heroicons:exclamation-triangle-16-solid" class="error-icon" />
        <span>{{ error }}</span>
      </div>

      <!-- Loaded Insights State (Deterministic Non-LLM Rule-Based) -->
      <div v-else-if="displayInsights" class="insights-text" v-html="formattedInsights"></div>

      <!-- Initial / Empty State -->
      <div v-else class="empty-state">
        <p>No comparison inputs provided yet. CAPEX analysis is idle.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { usePlatformVedaStore } from '~/stores/platformVedaStore'
import { useSubseaVedaStore } from '~/stores/subseaVedaStore'
import { useFpsoVedaStore } from '~/stores/fpsoVedaStore'
import { useVedaStore } from '~/stores/vedaStore'
import { generateRuleBasedNarrative } from '~/composables/useRuleBasedNarrative'

const props = withDefaults(defineProps<{
  insights?: string | null
  loading?: boolean
  error?: string | null
}>(), {
  insights: null,
  loading: false,
  error: null
})

const route = useRoute()

// Resolve active store (either injected via provide('forecastStore', store) or by current route)
const store = computed(() => {
  const injectedStore = inject<any>('forecastStore', null)
  if (injectedStore) return injectedStore
  if (route.path.startsWith('/subsea')) return useSubseaVedaStore()
  if (route.path.startsWith('/fpso')) return useFpsoVedaStore()
  if (route.path.startsWith('/platform')) return usePlatformVedaStore()
  return useVedaStore()
})

const isLoading = computed(() => {
  return props.loading || store.value?.loadingDetails || false
})

const ruleBasedResult = computed(() => {
  const s = store.value
  if (!s || !s.componentFindings || s.componentFindings.length === 0) return null

  // Check if comparationInputs exist and are populated
  const comparationInputs = s.comparationInputs || {}
  const components = s.componentFindings.map((c: any) => {
    const rawVal = comparationInputs[c.costType]
    const compVal = (rawVal !== undefined && rawVal !== null && rawVal !== '')
      ? Number(rawVal)
      : (c.forecast ?? c.baseline ?? 0)

    return {
      costType: c.costType,
      baseline: c.baseline || 0,
      compVal
    }
  })

  return generateRuleBasedNarrative(components, s.summaryFindings?.baselineTotal)
})

const displayInsights = computed(() => {
  if (props.insights) return props.insights
  return ruleBasedResult.value?.plainText || null
})

const formattedInsights = computed(() => {
  if (props.insights) {
    return props.insights
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
  }
  return ruleBasedResult.value?.formattedHtml || ''
})
</script>

<style scoped>
.ari-card {
  position: relative;
  background-color: #ffffff;
  border: 1.5px solid #fecaca; /* Soft red/pink border */
  border-radius: 16px;
  padding: 24px 32px;
  margin-top: 36px; /* Space for the tab */
  box-shadow: none;
}

/* Custom absolute tab on the top-left */
.ari-header-tab {
  position: absolute;
  top: -1.5px; /* Overlaps parent border exactly */
  left: 20px;
  transform: translateY(-100%);
  background-color: #ffffff;
  border: 1.5px solid #fecaca;
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  padding: 4px 16px;
  height: 32px;
  display: flex;
  align-items: center;
  z-index: 10;
}

/* Masking pseudo-element to cover the card's top border under the tab */
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
  color: #f43f5e; /* Elegant coral red */
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sparkle {
  color: #f97316; /* Warm orange sparkle */
  font-size: 16px;
}

.ari-content {
  min-height: 70px;
}

.insights-text {
  font-size: 16px;
  color: #334155;
  line-height: 1.6;
  font-weight: 450;
  letter-spacing: -0.1px;
}

/* Skeleton Styles */
.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-bar {
  height: 16px;
  width: 100%;
}

.line-1 {
  width: 95%;
}

.line-2 {
  width: 100%;
}

.line-3 {
  width: 60%;
}

/* Error State */
.error-state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-danger);
  font-weight: 600;
  font-size: 14px;
}

.error-icon {
  width: 20px;
  height: 20px;
}

/* Empty State */
.empty-state {
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
  padding: 12px 0;
}
</style>
