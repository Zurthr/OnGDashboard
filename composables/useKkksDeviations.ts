import { ref, reactive, computed } from 'vue'

/**
 * ── CONSTANTS & MAPPINGS ────────────────────────────────────────────────────
 */
export const STORAGE_KEY = 'kkks-modifier-overrides:v1'

export const CSV_COST_TYPES = [
  'substructure',
  'deck_structure',
  'production_facilities',
  'pipeline',
  'general_support',
  'certifications_permits',
] as const

export type CsvCostType =
  | 'substructure'
  | 'deck_structure'
  | 'production_facilities'
  | 'pipeline'
  | 'general_support'
  | 'certifications_permits'
export type StatType = 'avg' | 'median'

/**
 * Map CSV cost types to the application's forecast component names
 * found in CompareResults, GlanceScorecard, and offshore_forecast_api.
 */
export const CSV_TO_APP_COMPONENT_MAP: Record<CsvCostType, string> = {
  substructure: 'Substructure Cost',
  deck_structure: 'Deck Structure Cost',
  production_facilities: 'Production Facilities Cost',
  pipeline: 'Pipeline Costs',
  general_support: 'General Support Cost',
  certifications_permits: 'Certifications & Permits Costs',
}

export const APP_COMPONENT_TO_CSV_MAP: Record<string, CsvCostType> = {
  'Substructure Cost': 'substructure',
  'Deck Structure Cost': 'deck_structure',
  'Production Facilities Cost': 'production_facilities',
  'Pipeline Costs': 'pipeline',
  'General Support Cost': 'general_support',
  'Certifications & Permits Costs': 'certifications_permits',
}

export const VALID_APP_COMPONENTS = Object.values(CSV_TO_APP_COMPONENT_MAP)

/**
 * Normalize any input cost type string (either CSV key or app component name)
 * to the canonical app component name.
 */
export function normalizeCostType(costType: string): string {
  if (costType in CSV_TO_APP_COMPONENT_MAP) {
    return CSV_TO_APP_COMPONENT_MAP[costType as CsvCostType]
  }
  return costType
}

/**
 * ── DATA TYPES ──────────────────────────────────────────────────────────────
 */
export interface DeviationStats {
  avg: number | null
  median: number | null
}

export type ComponentDeviations = Record<string, DeviationStats>
export type KkksBaseline = Record<string, ComponentDeviations>

export interface StatOverride {
  avg?: number | null
  median?: number | null
}

export type KkksOverrides = Record<string, Record<string, StatOverride>>

export type ModifierStatus = 'adjusted' | 'no_data' | 'out_of_range'

export interface KkksModifierResult {
  value: number
  status: ModifierStatus
}

/**
 * Embedded raw CSV data for universal browser/SSR/test runtime compatibility.
 */
export const RAW_KKKS_DEVIATION_CSV = `kkks,substructure_avg_pct,substructure_median_pct,deck_structure_avg_pct,deck_structure_median_pct,production_facilities_avg_pct,production_facilities_median_pct,pipeline_avg_pct,pipeline_median_pct,general_support_avg_pct,general_support_median_pct,certifications_permits_avg_pct,certifications_permits_median_pct
BP BERAU LTD.,-6.94,-6.71,-53.63,-63.87,,,-28.49,-21.42,-6.29,-4.14,6.91,1.67
STARBORN ENERGY BONTANG PTE. LTD.,,,132.39,132.39,155.73,155.73,-1161.69,-1161.69,162.12,162.12,122.32,122.32
PC KETAPANG II LTD.,9.13,9.13,206.3,206.3,10.66,10.66,-0.98,-0.98,-6.09,-6.09,8.22,8.22
MEDCO ENERGI MADURA OFFSHORE PTY. LTD.,5.98,5.98,-37.64,-37.64,,,,,37.1,37.1,-10.16,-10.16
HUSKY-CNOOC MADURA LTD.,64.88,64.88,106.54,106.54,-43.42,-43.42,,,91.46,91.46,317.35,317.35
PT PERTAMINA HULU MAHAKAM,9.58,10.43,156.29,96.54,-34.06,-46.55,171.26,19.31,13.41,13.15,131.42,85.33
PC NORTH MADURA II LTD.,-2.37,-2.37,,,-29.59,-29.59,-92.54,-92.54,-1.98,-1.98,10.88,10.88
SAKA INDONESIA PANGKAH LTD.,171.24,171.24,-45.17,-45.17,,,220.17,220.17,115.19,115.19,53.92,53.92
MEDCO ENERGI SAMPANG PTY. LTD.,-37.62,-37.62,-198.02,-198.02,106.65,106.65,28.77,28.77,0.06,0.06,7.96,7.96
MEDCO E&P NATUNA LTD.,-7.92,-9.51,-37.48,-41.17,300.04,300.04,-8.79,-7.59,-3.39,-13.66,6.88,16.63
PREMIER OIL NATUNA SEA B.V.,,,,,,,,,,,,
PT PERTAMINA HULU ENERGY OSES,,,-132.88,-132.88,-114.46,-114.46,374.08,374.08,,,,
Prima Energy Northwest Natuna,,,,,-31.45,-31.45,,,,,,`

/**
 * ── LAYER 1: BASELINE CSV PARSER ────────────────────────────────────────────
 * Parses the CSV string once into a read-only Record<kkks, Record<costType, { avg, median }>>.
 * Empty fields become null (NEVER 0).
 */
export function parseKkksCsv(csvText: string): KkksBaseline {
  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length === 0) return {}

  const headerLine = lines[0]
  const headers = headerLine.split(',').map(h => h.trim())

  const kkksColIdx = headers.indexOf('kkks')
  if (kkksColIdx === -1) {
    throw new Error('CSV header missing "kkks" column')
  }

  // Pre-calculate column indices for each cost type and stat
  const colMap: Record<CsvCostType, { avgIdx: number; medianIdx: number }> = {} as any
  for (const ct of CSV_COST_TYPES) {
    colMap[ct] = {
      avgIdx: headers.indexOf(`${ct}_avg_pct`),
      medianIdx: headers.indexOf(`${ct}_median_pct`),
    }
  }

  const baseline: KkksBaseline = {}

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const cells = line.split(',')
    const kkksName = cells[kkksColIdx]?.trim()
    if (!kkksName) continue

    const components: ComponentDeviations = {}

    for (const ct of CSV_COST_TYPES) {
      const appComponentName = CSV_TO_APP_COMPONENT_MAP[ct]
      const { avgIdx, medianIdx } = colMap[ct]

      const parseField = (idx: number): number | null => {
        if (idx === -1 || idx >= cells.length) return null
        const val = cells[idx]?.trim()
        if (val === '' || val === undefined) return null
        const num = Number(val)
        return Number.isFinite(num) ? num : null
      }

      components[appComponentName] = {
        avg: parseField(avgIdx),
        median: parseField(medianIdx),
      }
    }

    baseline[kkksName] = components
  }

  return Object.freeze(baseline)
}

/**
 * Baseline parsed once from the default CSV data.
 */
export const BASELINE_KKKS_DEVIATIONS: KkksBaseline = parseKkksCsv(RAW_KKKS_DEVIATION_CSV)

/**
 * ── STORAGE UTILITIES ───────────────────────────────────────────────────────
 */
export function storageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false
    }
    const testKey = '__kkks_storage_test__'
    window.localStorage.setItem(testKey, testKey)
    window.localStorage.removeItem(testKey)
    return true
  } catch {
    return false
  }
}

/**
 * Validate and sanitize stored overrides object:
 * - Drops unknown KKKS names
 * - Drops unknown cost types
 * - Validates avg/median are finite numbers or null
 * - Drops unknown keys
 */
export function validateAndSanitizeOverrides(
  raw: unknown,
  validKkks: string[] = Object.keys(BASELINE_KKKS_DEVIATIONS),
  validComponents: string[] = VALID_APP_COMPONENTS
): KkksOverrides {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }

  const sanitized: KkksOverrides = {}
  const rawObj = raw as Record<string, unknown>

  for (const [kkks, componentsObj] of Object.entries(rawObj)) {
    if (!validKkks.includes(kkks)) continue
    if (!componentsObj || typeof componentsObj !== 'object' || Array.isArray(componentsObj)) continue

    for (const [compRaw, statsObj] of Object.entries(componentsObj as Record<string, unknown>)) {
      const compName = normalizeCostType(compRaw)
      if (!validComponents.includes(compName)) continue
      if (!statsObj || typeof statsObj !== 'object' || Array.isArray(statsObj)) continue

      const stats = statsObj as Record<string, unknown>
      const cleanStats: StatOverride = {}

      if ('avg' in stats) {
        if (stats.avg === null || (typeof stats.avg === 'number' && Number.isFinite(stats.avg))) {
          cleanStats.avg = stats.avg
        }
      }

      if ('median' in stats) {
        if (stats.median === null || (typeof stats.median === 'number' && Number.isFinite(stats.median))) {
          cleanStats.median = stats.median
        }
      }

      if (Object.keys(cleanStats).length > 0) {
        if (!sanitized[kkks]) sanitized[kkks] = {}
        sanitized[kkks][compName] = cleanStats
      }
    }
  }

  return sanitized
}

export function loadOverridesFromStorage(
  storageKey: string = STORAGE_KEY,
  validKkks: string[] = Object.keys(BASELINE_KKKS_DEVIATIONS)
): KkksOverrides {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        return validateAndSanitizeOverrides(parsed, validKkks)
      }
    }
  } catch (err) {
    console.warn('[useKkksDeviations] Could not read from localStorage, using in-memory state:', err)
  }
  return {}
}

export function saveOverridesToStorage(
  overrides: KkksOverrides,
  storageKey: string = STORAGE_KEY
): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify(overrides))
    }
  } catch (err) {
    console.warn('[useKkksDeviations] Could not save to localStorage, using in-memory state:', err)
  }
}

/**
 * ── LAYER 3: MERGE LOGIC ────────────────────────────────────────────────────
 * Merges baseline and overrides for a single KKKS.
 * If an override key exists (even if set to null), it takes precedence over baseline.
 */
export function mergeKkksEffective(
  baselineKkks: ComponentDeviations | undefined,
  overridesKkks: Record<string, StatOverride> | undefined
): ComponentDeviations | null {
  if (!baselineKkks) return null

  const effective: ComponentDeviations = {}

  for (const [compName, baseStats] of Object.entries(baselineKkks)) {
    const compOverride = overridesKkks ? overridesKkks[compName] : undefined

    effective[compName] = {
      avg: (compOverride && 'avg' in compOverride) ? compOverride.avg! : baseStats.avg,
      median: (compOverride && 'median' in compOverride) ? compOverride.median! : baseStats.median,
    }
  }

  return effective
}

/**
 * ── PURE FUNCTION: APPLY KKKS MODIFIER ──────────────────────────────────────
 * Formula: applyKkksModifier(rawForecast, deviationPct) = rawForecast / (1 + deviationPct / 100)
 *
 * Guards:
 * - deviationPct is null/undefined -> returns raw forecast with status "no_data"
 * - deviationPct <= -100 -> returns raw forecast with status "out_of_range"
 * - otherwise -> returns adjusted value with status "adjusted"
 */
export function applyKkksModifier(
  rawForecast: number,
  deviationPct: number | null | undefined
): KkksModifierResult {
  if (deviationPct === null || deviationPct === undefined) {
    return { value: rawForecast, status: 'no_data' }
  }

  if (deviationPct <= -100) {
    return { value: rawForecast, status: 'out_of_range' }
  }

  const adjusted = rawForecast / (1 + deviationPct / 100)
  return { value: adjusted, status: 'adjusted' }
}

/**
 * ── SINGLETON / COMPOSABLE HOOK ─────────────────────────────────────────────
 */
// Shared in-memory reactive overrides state
const sharedOverrides = reactive<KkksOverrides>({})
let isInitialized = false

function initOverrides() {
  if (isInitialized) return
  isInitialized = true
  const loaded = loadOverridesFromStorage()
  for (const [k, v] of Object.entries(loaded)) {
    sharedOverrides[k] = v
  }
}

/**
 * Composable hook: useKkksDeviations
 */
export function useKkksDeviations(baseline: KkksBaseline = BASELINE_KKKS_DEVIATIONS) {
  initOverrides()

  /**
   * Get all available KKKS names from the baseline.
   */
  const kkksList = computed<string[]>(() => Object.keys(baseline))

  /**
   * Layer 3: Effective values for a specific KKKS.
   * Everything in the app reads from this.
   */
  function getEffective(kkks: string): ComponentDeviations | null {
    const base = baseline[kkks]
    if (!base) return null
    return mergeKkksEffective(base, sharedOverrides[kkks])
  }

  /**
   * Set user override for a specific cell.
   * value can be a number or null (e.g. override to no data).
   */
  function setOverride(
    kkks: string,
    costType: string,
    stat: StatType,
    value: number | null
  ): void {
    const normalized = normalizeCostType(costType)
    if (!sharedOverrides[kkks]) {
      sharedOverrides[kkks] = {}
    }
    if (!sharedOverrides[kkks][normalized]) {
      sharedOverrides[kkks][normalized] = {}
    }

    sharedOverrides[kkks][normalized][stat] = value
    saveOverridesToStorage(sharedOverrides)
  }

  /**
   * Reset an individual cell or entire component row override.
   * If stat is provided: resets only that stat ('avg' or 'median').
   * If stat is omitted: resets both stats for that component.
   */
  function resetCell(
    kkks: string,
    costType: string,
    stat?: StatType
  ): void {
    const normalized = normalizeCostType(costType)
    if (!sharedOverrides[kkks] || !sharedOverrides[kkks][normalized]) return

    if (stat) {
      delete sharedOverrides[kkks][normalized][stat]
      if (Object.keys(sharedOverrides[kkks][normalized]).length === 0) {
        delete sharedOverrides[kkks][normalized]
      }
    } else {
      delete sharedOverrides[kkks][normalized]
    }

    if (Object.keys(sharedOverrides[kkks]).length === 0) {
      delete sharedOverrides[kkks]
    }

    saveOverridesToStorage(sharedOverrides)
  }

  /**
   * Reset all overrides for a specific KKKS.
   */
  function resetKkks(kkks: string): void {
    if (sharedOverrides[kkks]) {
      delete sharedOverrides[kkks]
      saveOverridesToStorage(sharedOverrides)
    }
  }

  /**
   * Reset all overrides across all KKKS.
   */
  function resetAll(): void {
    for (const key of Object.keys(sharedOverrides)) {
      delete sharedOverrides[key]
    }
    saveOverridesToStorage(sharedOverrides)
  }

  /**
   * Check if a cell, cost component, or KKKS is currently overridden.
   */
  function isOverridden(
    kkks: string,
    costType?: string,
    stat?: StatType
  ): boolean {
    if (!sharedOverrides[kkks]) return false

    if (!costType) {
      return Object.keys(sharedOverrides[kkks]).length > 0
    }

    const normalized = normalizeCostType(costType)
    const compOverride = sharedOverrides[kkks][normalized]
    if (!compOverride) return false

    if (!stat) {
      return Object.keys(compOverride).length > 0
    }

    return stat in compOverride
  }

  return {
    baseline,
    kkksList,
    overrides: sharedOverrides,
    getEffective,
    setOverride,
    resetCell,
    resetKkks,
    resetAll,
    isOverridden,
    storageAvailable,
    applyKkksModifier,
  }
}
