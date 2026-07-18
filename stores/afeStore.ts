// stores/afeStore.ts
// ---------------------------------------------------------------------------
// Shared store for AFE repository data. Both the Repository page and the
// Dashboard read from this store. Data now lives in the SQLite database
// (via server/api/afe/*), not in localStorage — this store just holds an
// in-memory cache of the last fetch, refreshed by calling fetchAll().
//
// CSV import (curated_records.csv / dlq_records.csv) now happens entirely
// server-side, triggered from the Extraction page's "Import to Repository"
// button (see server/api/afe/import.post.ts). This store no longer parses
// CSVs itself.
// ---------------------------------------------------------------------------

import { defineStore } from 'pinia'

export type Row = Record<string, string | number | null>

export interface DlqEntry {
  id: number
  afe_number: string
  parameter_name: string
  sub_parameter: string | null
  raw_value: string | null
  normalized_value: string | null
  failed_rule: string | null
  error_type: string | null
  severity: string | null
  failure_action: string | null
  reference_context: string | null
  pages: string | null
  json_path: string | null
  source_file: string | null
  resolved: number
  resolved_at: string | null
}

interface AfeState {
  rows: Row[]
  dlqEntries: DlqEntry[]
  loading: boolean
  error: string | null
  lastFetched: number | null
}

export const useAfeStore = defineStore('afe', {
  state: (): AfeState => ({
    rows: [],
    dlqEntries: [],
    loading: false,
    error: null,
    lastFetched: null,
  }),

  getters: {
    hasData: (s) => s.rows.length > 0,
    totalRecords: (s) => s.rows.length,
    platformCount: (s) => s.rows.filter(r => String(r.project_type ?? '').toLowerCase().includes('platform')).length,
    dlqCount: (s) => s.dlqEntries.filter(d => !d.resolved).length,

    avgWaterDepth: (s) => {
      const nums = s.rows.map(r => parseFloat(String(r.water_depth))).filter(n => !isNaN(n))
      return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) + ' m' : '—'
    },

    /** Get numeric values for a given column key (filters out nulls/NaN) */
    numericValues: (s) => (key: string): number[] => {
      return s.rows.map(r => parseFloat(String(r[key]))).filter(n => !isNaN(n))
    },

    /** Check if a specific cell has an UNRESOLVED DLQ flag */
    hasDlqFlag: (s) => (afe: string | null | undefined, param?: string, sub?: string): boolean => {
      if (!afe || !param || !s.dlqEntries.length) return false
      return s.dlqEntries.some(d =>
        !d.resolved &&
        d.afe_number === afe &&
        d.parameter_name.toLowerCase() === param.toLowerCase() &&
        (sub ? (d.sub_parameter ?? '').toLowerCase() === sub.toLowerCase() : true)
      )
    },

    /** Get the tooltip text for a DLQ-flagged cell (unresolved entries only) */
    getDlqTooltip: (s) => (afe: string | null | undefined, param?: string, sub?: string): string => {
      if (!afe || !param) return ''
      const match = s.dlqEntries.find(d =>
        !d.resolved &&
        d.afe_number === afe &&
        d.parameter_name.toLowerCase() === param.toLowerCase() &&
        (sub ? (d.sub_parameter ?? '').toLowerCase() === sub.toLowerCase() : true)
      )
      return match ? `⚠ ${match.failed_rule}: ${match.error_type} (${match.severity})` : ''
    },
  },

  actions: {
    /** Fetch all records + all DLQ entries from the database. Call on page mount. */
    async fetchAll() {
      this.loading = true
      this.error = null
      try {
        const [rows, dlqEntries] = await Promise.all([
          $fetch<Row[]>('/api/afe'),
          $fetch<DlqEntry[]>('/api/afe/dlq'),
        ])
        this.rows = rows
        this.dlqEntries = dlqEntries
        this.lastFetched = Date.now()
      } catch (e: any) {
        this.error = e?.data?.statusMessage ?? e.message ?? 'Failed to load repository data.'
      } finally {
        this.loading = false
      }
    },

    /** Update a single field on a record, then refresh from the database. */
    async updateRecord(afeNumber: string, changes: Record<string, string | number | null>) {
      await $fetch('/api/afe/update', {
        method: 'POST',
        body: { afe_number: afeNumber, ...changes },
      })
      await this.fetchAll()
    },

<<<<<<< Updated upstream
    /** Export the current (filtered/sorted) view, matching each imported
     *  file's original format. Returns one file if only curated was
     *  imported, or two files (curated + DLQ) if both were imported. Only
     *  rows belonging to the given AFE numbers are included, so this
     *  respects whatever search/sort/filter is active on the repository page. */
    exportCurrentView(visibleAfeNumbers: string[]): { curated: string; dlq: string | null } | null {
      if (!this.rawCurated) return null
      const afeSet = new Set(visibleAfeNumbers)

      const curatedRows = this.rawCurated.rows.filter(r => afeSet.has(r['AFE_Number']))
      const curated = toCsv(this.rawCurated.headers, curatedRows)

      let dlq: string | null = null
      if (this.dlqImported && this.rawDlq) {
        const dlqRows = this.rawDlq.rows.filter(r => afeSet.has(r['AFE_Number']))
        dlq = toCsv(this.rawDlq.headers, dlqRows)
      }

      return { curated, dlq }
    },

    /** Clear all data (rows + DLQ + raw imports + localStorage) */
    clearAll() {
      this.rows = []
      this.dlqEntries = []
      this.curatedImported = false
      this.dlqImported = false
      this.rawCurated = null
      this.rawDlq = null
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

/* ── CSV serializer — rebuilds a CSV string from headers + row objects,
     quoting any value that itself contains a comma. ── */
function toCsv(headers: string[], rows: Record<string, string>[]): string {
  const escape = (v: string) => (v.includes(',') || v.includes('"'))
    ? `"${v.replace(/"/g, '""')}"`
    : v
  const headerLine = headers.map(escape).join(',')
  const bodyLines = rows.map(r => headers.map(h => escape(r[h] ?? '')).join(','))
  return [headerLine, ...bodyLines].join('\n')
}
=======
    /** Delete one record, then refresh from the database. */
    async deleteRecord(afeNumber: string) {
      await $fetch('/api/afe/delete', {
        method: 'POST',
        body: { afe_number: afeNumber },
      })
      await this.fetchAll()
    },
  },
})
>>>>>>> Stashed changes
