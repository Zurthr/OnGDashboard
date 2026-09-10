import { inject } from 'vue'
import type { Store } from 'pinia'

/**
 * Composable used by all Forecast/* components.
 * The parent page must `provide('forecastStore', <store instance>)` so that
 * all three forecast pages (Platform, Subsea, FPSO) can share the same
 * component folder while maintaining fully isolated Pinia state.
 */
export function useForecastStore() {
  const store = inject<any>('forecastStore')
  if (!store) {
    throw new Error('[useForecastStore] No store provided. The parent page must call provide("forecastStore", storeInstance).')
  }
  return store
}
