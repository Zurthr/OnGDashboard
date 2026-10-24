/**
 * useKkksAdjustedForecasts.ts
 *
 * Computes KKKS-adjusted forecasts for a given set of component findings.
 * Only reads store state; never writes to it. Safe to use in any component.
 *
 * Rules:
 *  - Mode "none" or no KKKS selected → output identical to raw baseline
 *  - Mode "median" → use each component's median deviation
 *  - Mode "mean"   → use each component's avg deviation
 *  - Total is always sum of adjusted components (never apply one % to total)
 *  - NaN, Infinity, negative values are clamped to 0
 */

import { computed } from 'vue'
import { applyKkksModifier, useKkksDeviations } from '~/composables/useKkksDeviations'
import type { KkksModifierResult } from '~/composables/useKkksDeviations'

export type ModifierMode = 'none' | 'median' | 'mean'

export interface AdjustedComponent {
  costType: string
  /** Raw value from the store (finding.baseline) */
  rawValue: number
  /** Adjusted value after applying the KKKS modifier */
  adjustedValue: number
  /** Whether the value actually changed from raw */
  isAdjusted: boolean
  /** Status from applyKkksModifier */
  status: KkksModifierResult['status']
  /** Deviation % that was applied (null if no_data / out_of_range / mode=none) */
  deviationPct: number | null
}

export interface AdjustedForecastResult {
  components: AdjustedComponent[]
  /** Sum of all adjustedValues — this is the value to display as the total */
  totalAdjusted: number
  /** Original sum of all rawValues */
  totalRaw: number
  /** Whether any component was actually adjusted */
  anyAdjusted: boolean
  /** Whether KKKS modifier is active (kkks selected AND mode !== 'none') */
  modifierActive: boolean
}

/** Clamp a number to be finite and non-negative */
function safeValue(v: number): number {
  if (!isFinite(v) || isNaN(v) || v < 0) return 0
  return v
}

/**
 * Returns a reactive computed object with all adjusted components + totals.
 * Pass the raw component findings array (each having `.costType` and `.baseline`).
 */
export function useKkksAdjustedForecasts(
  getFindings: () => Array<{ costType: string; baseline: number }>,
  getSelectedKkks: () => string | null,
  getMode: () => ModifierMode
) {
  const { getEffective } = useKkksDeviations()

  const result = computed<AdjustedForecastResult>(() => {
    const findings = getFindings()
    const kkks = getSelectedKkks()
    const mode = getMode()

    const modifierActive = !!kkks && mode !== 'none'

    const components: AdjustedComponent[] = findings.map(finding => {
      const raw = safeValue(finding.baseline)

      if (!modifierActive) {
        return {
          costType: finding.costType,
          rawValue: raw,
          adjustedValue: raw,
          isAdjusted: false,
          status: 'no_data' as const,
          deviationPct: null,
        }
      }

      const effective = getEffective(kkks!)
      const compDeviation = effective ? effective[finding.costType] : null
      const deviationPct = compDeviation
        ? (mode === 'median' ? compDeviation.median : compDeviation.avg)
        : null

      const modResult = applyKkksModifier(raw, deviationPct)
      const adjustedValue = safeValue(modResult.value)

      return {
        costType: finding.costType,
        rawValue: raw,
        adjustedValue,
        isAdjusted: modResult.status === 'adjusted',
        status: modResult.status,
        deviationPct,
      }
    })

    const totalRaw = components.reduce((s, c) => s + c.rawValue, 0)
    const totalAdjusted = components.reduce((s, c) => s + c.adjustedValue, 0)
    const anyAdjusted = components.some(c => c.isAdjusted)

    return {
      components,
      totalAdjusted,
      totalRaw,
      anyAdjusted,
      modifierActive,
    }
  })

  return { result }
}
