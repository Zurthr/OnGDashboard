<template>
  <ForecastStickyNav />
  <div class="container">
    <GlanceScorecard />
    <LocationMap />
    <CompareResults />
    <AriInsights />
    <DevTools />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'
import GlanceScorecard from '~/components/Forecast/GlanceScorecard.vue'
import LocationMap from '~/components/Forecast/LocationMap.vue'
import CompareResults from '~/components/Forecast/CompareResults.vue'
import AriInsights from '~/components/Forecast/AriInsights.vue'
import DevTools from '~/components/Forecast/DevTools.vue'

import { useRoute } from 'vue-router'

const store = useVedaStore()
const route = useRoute()

onMounted(async () => {
  const scenarioIdParam = route.query.scenarioId ? Number(route.query.scenarioId) : null
  const locationParam = route.query.location ? String(route.query.location) : null

  if (scenarioIdParam && !isNaN(scenarioIdParam)) {
    store.selectedScenarioId = scenarioIdParam
  }
  if (locationParam) {
    store.selectedLocation = locationParam
  }

  await store.fetchScenarios()

  if (scenarioIdParam && !isNaN(scenarioIdParam)) {
    await store.selectScenario(scenarioIdParam)
  }
})

// Title SEO meta tags
useHead({
  title: 'SKK Migas - Veda CAPEX Forecasting Compare Results',
  meta: [
    { name: 'description', content: 'Advanced financial Capex comparing results dashboard powered by Veda AI Engine.' }
  ]
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
  padding: 80px 40px 80px;
}
</style>
