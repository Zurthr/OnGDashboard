<template>
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

const store = useVedaStore()

// Format Ari insights with bold markers
const formattedInsights = computed(() => {
  if (!store.insights) return ''
  // Wrap **text** in <strong> tags
  return store.insights
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
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
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}
</style>
