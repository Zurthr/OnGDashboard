// stores/afeStore.ts
// ---------------------------------------------------------------------------
// Shared store for AFE repository data. Both the Repository page and the
// Dashboard read from this store. The Repository page writes to it when the
// user imports CSVs.
//
// Route-change persistence: Pinia keeps state in memory across navigations.
// Refresh persistence: localStorage backup — on import, state is saved to
// localStorage; on store init, it's restored. This way a page refresh doesn't
// lose the imported data. The clear action wipes both.
// ---------------------------------------------------------------------------

import { defineStore } from 'pinia'

export type Row = Record<string, string | number | null>

export interface DlqEntry {
  afe: string
  param: string
  sub: string
  rule: string
  error: string
  severity: string
}

interface AfeState {
  rows: Row[]
  dlqEntries: DlqEntry[]
  curatedImported: boolean
  dlqImported: boolean
}

const STORAGE_KEY = 'afe-repo-data'

function saveToStorage(state: AfeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rows: state.rows,
      dlqEntries: state.dlqEntries,
      curatedImported: state.curatedImported,
      dlqImported: state.dlqImported,
    }))
  } catch { /* quota exceeded or unavailable — ignore */ }
}

function loadFromStorage(): Partial<AfeState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const useAfeStore = defineStore('afe', {
  state: (): AfeState => {
    const saved = loadFromStorage()
    return {
      rows: saved?.rows ?? [],
      dlqEntries: saved?.dlqEntries ?? [],
      curatedImported: saved?.curatedImported ?? false,
      dlqImported: saved?.dlqImported ?? false,
    }
  },

  getters: {
    totalRecords: (s) => s.rows.length,
    platformCount: (s) => s.rows.filter(r => String(r.project_type ?? '').toLowerCase().includes('platform')).length,
    dlqCount: (s) => s.dlqEntries.length,

    avgWaterDepth: (s) => {
      const nums = s.rows.map(r => parseFloat(String(r.water_depth))).filter(n => !isNaN(n))
      return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) + ' m' : '—'
    },

    /** Get numeric values for a given column key (filters out nulls/NaN) */
    numericValues: (s) => (key: string): number[] => {
      return s.rows.map(r => parseFloat(String(r[key]))).filter(n => !isNaN(n))
    },

    /** Check if a specific cell has a DLQ flag */
    hasDlqFlag: (s) => (afe: string | null | undefined, param?: string, sub?: string): boolean => {
      if (!afe || !param || !s.dlqEntries.length) return false
      return s.dlqEntries.some(d =>
        d.afe === afe &&
        d.param.toLowerCase() === param.toLowerCase() &&
        (sub ? d.sub.toLowerCase() === sub.toLowerCase() : true)
      )
    },

    /** Get the tooltip text for a DLQ-flagged cell */
    getDlqTooltip: (s) => (afe: string | null | undefined, param?: string, sub?: string): string => {
      if (!afe || !param) return ''
      const match = s.dlqEntries.find(d =>
        d.afe === afe &&
        d.param.toLowerCase() === param.toLowerCase() &&
        (sub ? d.sub.toLowerCase() === sub.toLowerCase() : true)
      )
      return match ? `⚠ ${match.rule}: ${match.error} (${match.severity})` : ''
    },
  },

  actions: {
    /** Import curated_records.csv (long format) and pivot to flat rows */
    importCurated(headers: string[], lines: string[]) {
      const iAfe = headers.indexOf('AFE_Number')
      const iParam = headers.indexOf('parameter_name')
      const iSub = headers.indexOf('sub_parameter')
      const iVal = headers.indexOf('value')
      const iUnit = headers.indexOf('unit')

      if (iAfe < 0 || iParam < 0 || iVal < 0) {
        throw new Error('CSV missing required columns: AFE_Number, parameter_name, value')
      }

      const grouped: Record<string, Row> = {}
      for (const line of lines) {
        if (!line.trim()) continue
        const vals = parseCsvLine(line)
        const afe = vals[iAfe] || ''
        const param = (vals[iParam] || '').toLowerCase()
        const sub = (vals[iSub] || '').trim()
        const val = vals[iVal] || ''
        const unit = vals[iUnit] || ''

        if (!afe || afe === 'AFE_Number') continue
        if (!grouped[afe]) {
          grouped[afe] = {
            _afe: afe, afe_number: afe, project_type: null,
            water_depth: null, water_depth_unit: null,
            topside_weight: null, jacket_weight: null, piling_weight: null,
            number_of_legs: null, number_of_slots: null,
            equip_wellhead: null, equip_processing: null, equip_utilities: null,
            h2s: null, co2: null, hg: null,
          }
        }

        const r = grouped[afe]
        const numVal = parseFloat(val)
        const isNum = val !== '' && !isNaN(numVal)

        if (param === 'afe_number') { r.afe_number = val }
        else if (param === 'project_type') { r.project_type = val }
        else if (param === 'water_depth') { r.water_depth = isNum ? numVal : (val || null); r.water_depth_unit = unit || null }
        else if (param === 'topside_weight') { r.topside_weight = isNum ? numVal : (val || null) }
        else if (param === 'jacket_weight') { r.jacket_weight = isNum ? numVal : (val || null) }
        else if (param === 'piling_weight') { r.piling_weight = isNum ? numVal : (val || null) }
        else if (param === 'number_of_legs') { r.number_of_legs = isNum ? numVal : (val || null) }
        else if (param === 'number_of_slots') { r.number_of_slots = isNum ? numVal : (val || null) }
        else if (param === 'topside_equipment') {
          if (sub.toLowerCase() === 'wellhead') r.equip_wellhead = val || null
          else if (sub.toLowerCase() === 'processing') r.equip_processing = val || null
          else if (sub.toLowerCase() === 'utilities') r.equip_utilities = val || null
        }
        else if (param === 'impurities') {
          if (sub.toLowerCase() === 'h2s') r.h2s = isNum ? numVal : (val || null)
          else if (sub.toLowerCase() === 'co2') r.co2 = isNum ? numVal : (val || null)
          else if (sub.toLowerCase() === 'hg') r.hg = isNum ? numVal : (val || null)
        }
      }
      this.rows = Object.values(grouped)
      this.curatedImported = true
      saveToStorage(this.$state)
    },

    /** Import dlq_records.csv for cell-level quality flags */
    importDlq(headers: string[], lines: string[]) {
      const iAfe = headers.indexOf('AFE_Number')
      const iParam = headers.indexOf('parameter_name')
      const iSub = headers.indexOf('sub_parameter')
      const iRule = headers.indexOf('failed_rule')
      const iErr = headers.indexOf('error_type')
      const iSev = headers.indexOf('severity')

      if (iAfe < 0 || iParam < 0) {
        throw new Error('DLQ CSV missing required columns: AFE_Number, parameter_name')
      }

      const entries: DlqEntry[] = []
      for (const line of lines) {
        if (!line.trim()) continue
        const vals = parseCsvLine(line)
        const afe = vals[iAfe] || ''
        if (!afe || afe === 'AFE_Number') continue
        entries.push({
          afe,
          param: vals[iParam] || '',
          sub: vals[iSub] || '',
          rule: vals[iRule] || '',
          error: vals[iErr] || '',
          severity: vals[iSev] || '',
        })
      }
      this.dlqEntries = entries
      this.dlqImported = true
      saveToStorage(this.$state)
    },

    /** Clear all data (rows + DLQ + localStorage) */
    clearAll() {
      this.rows = []
      this.dlqEntries = []
      this.curatedImported = false
      this.dlqImported = false
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
    },
  },
})

/* ── CSV line parser (handles quoted fields with commas) ── */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}
