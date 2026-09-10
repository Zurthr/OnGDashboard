<template>
  <ForecastStickyNav />
  <div class="container">
    <ForecastGlanceScorecard />
    <ForecastLocationMap />
    <ForecastCompareResults />
    <ForecastAriInsights />
    <ForecastDevTools />
  </div>
</template>

<script setup lang="ts">
import { onMounted, provide } from 'vue'
import { useSubseaVedaStore } from '~/stores/subseaVedaStore'
import { useRoute } from 'vue-router'

const store = useSubseaVedaStore()
provide('forecastStore', store)
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

useHead({
  title: 'SKK Migas - Veda CAPEX Forecasting | Subsea',
  meta: [
    { name: 'description', content: 'Subsea CAPEX forecasting dashboard powered by Veda AI Engine.' }
  ]
})
</script>

<style scoped>
.container {
  max-width: 1360px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 80px 40px 80px;
}
</style>
