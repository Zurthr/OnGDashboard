<template>
  <div class="page">
    <div class="page-head">
      <div>
        <span class="eyebrow">AFE Module</span>
        <h1 class="page-title">Project Repository</h1>
        <p class="page-sub">
          Curated AFE technical parameters from the ETL pipeline. Import the curated CSV and optionally the DLQ CSV to flag quality issues.
        </p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" @click="curatedInput?.click()">
          <Icon name="heroicons:arrow-up-tray" class="btn-ic" /> Import Curated
        </button>
        <input ref="curatedInput" type="file" accept=".csv" hidden @change="e => handleImport(e, 'curated')" />
        <button class="btn btn-ghost" @click="dlqInput?.click()">
          <Icon name="heroicons:exclamation-triangle" class="btn-ic" /> Import DLQ
        </button>
        <input ref="dlqInput" type="file" accept=".csv" hidden @change="e => handleImport(e, 'dlq')" />
        <button class="btn btn-ghost" :disabled="!store.totalRecords" @click="exportCsv">
          <Icon name="heroicons:arrow-down-tray" class="btn-ic" /> Export
        </button>
        <button class="btn btn-danger" :disabled="!store.totalRecords && !store.dlqCount" @click="confirmClear">
          <Icon name="heroicons:trash" class="btn-ic" /> Clear
        </button>
      </div>
    </div>

    <!-- Warnings -->
    <div v-if="!store.curatedImported" class="warn-banner">
      <Icon name="heroicons:information-circle" class="warn-ic" />
      <span>No curated data loaded. Import <strong>curated_records.csv</strong> from the Data Engineer to populate the repository.</span>
    </div>
    <div v-if="store.curatedImported && !store.dlqImported" class="warn-banner warn-banner--soft">
      <Icon name="heroicons:exclamation-triangle" class="warn-ic" />
      <span>DLQ data not loaded. Import <strong>dlq_records.csv</strong> to see quality flags on cells, or continue without it.</span>
    </div>

    <!-- Scorecard strip -->
    <div class="scorecard-row" v-if="store.curatedImported">
      <div class="sc-card"><span class="sc-label">Total AFEs</span><span class="sc-val num-font">{{ store.totalRecords }}</span></div>
      <div class="sc-card"><span class="sc-label">Platform</span><span class="sc-val num-font">{{ store.platformCount }}</span></div>
      <div class="sc-card"><span class="sc-label">Avg Water Depth</span><span class="sc-val num-font">{{ store.avgWaterDepth }}</span></div>
      <div class="sc-card" :class="{ 'warn-card': store.dlqCount > 0 }"><span class="sc-label">DLQ Flags</span><span class="sc-val num-font">{{ store.dlqCount }}</span></div>
    </div>

    <!-- Table -->
    <section class="card table-card" v-if="store.curatedImported">
      <span class="card-bar"></span>
      <div class="table-toolbar">
        <div class="search-wrap">
          <Icon name="heroicons:magnifying-glass" class="search-ic" />
          <input v-model="search" class="search-input" placeholder="Search by AFE number, type, asset…" />
        </div>
        <span class="result-count">{{ filtered.length }} record{{ filtered.length !== 1 ? 's' : '' }}</span>
      </div>

      <div class="table-scroll">
        <table class="repo-table">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col.key" @click="toggleSort(col.key)" class="sortable-th">
                <span>{{ col.label }}</span>
                <Icon v-if="sortKey === col.key" :name="sortAsc ? 'heroicons:chevron-up-20-solid' : 'heroicons:chevron-down-20-solid'" class="sort-ic" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in paginated" :key="i">
              <td v-for="col in columns" :key="col.key"
                :class="{
                  'num-font': col.numeric,
                  'cell-empty': row[col.key] == null || row[col.key] === '',
                  'cell-flagged': store.hasDlqFlag(row._afe as string, col.paramKey || col.key, col.subParam)
                }"
                :title="store.getDlqTooltip(row._afe as string, col.paramKey || col.key, col.subParam)"
              >
                <span v-if="store.hasDlqFlag(row._afe as string, col.paramKey || col.key, col.subParam)" class="flag-dot" />
                {{ row[col.key] != null && row[col.key] !== '' ? row[col.key] : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Legend -->
      <div v-if="store.dlqCount > 0" class="legend">
        <span class="flag-dot flag-dot--legend" /> <span class="legend-text">Cell flagged by DLQ — hover for details</span>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="pg-btn" :disabled="page <= 1" @click="page--"><Icon name="heroicons:chevron-left-20-solid" /></button>
        <span class="pg-info num-font">{{ page }} / {{ totalPages }}</span>
        <button class="pg-btn" :disabled="page >= totalPages" @click="page++"><Icon name="heroicons:chevron-right-20-solid" /></button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAfeStore } from '~/stores/afeStore'

useHead({ title: 'SKK Migas — Project Repository' })

const store = useAfeStore()

/* ── Column definitions ──────────────────────────────── */
const columns: { key: string; label: string; numeric: boolean; paramKey?: string; subParam?: string }[] = [
  { key: 'afe_number', label: 'AFE Number', numeric: false },
  { key: 'project_type', label: 'Type', numeric: false, paramKey: 'Project_Type' },
  { key: 'water_depth', label: 'Water Depth', numeric: true, paramKey: 'water_depth' },
  { key: 'water_depth_unit', label: 'WD Unit', numeric: false },
  { key: 'topside_weight', label: 'Topside Wt', numeric: true, paramKey: 'topside_weight' },
  { key: 'jacket_weight', label: 'Jacket Wt', numeric: true, paramKey: 'jacket_weight' },
  { key: 'piling_weight', label: 'Piling Wt', numeric: true, paramKey: 'piling_weight' },
  { key: 'number_of_legs', label: 'Legs', numeric: true, paramKey: 'number_of_legs' },
  { key: 'number_of_slots', label: 'Slots', numeric: true, paramKey: 'number_of_slots' },
  { key: 'equip_wellhead', label: 'Wellhead', numeric: false, paramKey: 'topside_equipment', subParam: 'Wellhead' },
  { key: 'equip_processing', label: 'Processing', numeric: false, paramKey: 'topside_equipment', subParam: 'Processing' },
  { key: 'equip_utilities', label: 'Utilities', numeric: false, paramKey: 'topside_equipment', subParam: 'Utilities' },
  { key: 'h2s', label: 'H₂S', numeric: true, paramKey: 'impurities', subParam: 'H2S' },
  { key: 'co2', label: 'CO₂', numeric: true, paramKey: 'impurities', subParam: 'CO2' },
  { key: 'hg', label: 'Hg', numeric: true, paramKey: 'impurities', subParam: 'Hg' },
]

/* ── Local UI state ──────────────────────────────────── */
const search = ref('')
const sortKey = ref('afe_number')
const sortAsc = ref(true)
const page = ref(1)
const perPage = 25
const curatedInput = ref<HTMLInputElement | null>(null)
const dlqInput = ref<HTMLInputElement | null>(null)

/* ── Derived ─────────────────────────────────────────── */
const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  let list = store.rows
  if (q) list = list.filter(r => columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q)))
  list = [...list].sort((a, b) => {
    const va = a[sortKey.value], vb = b[sortKey.value]
    if (va == null && vb == null) return 0
    if (va == null) return 1; if (vb == null) return -1
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sortAsc.value ? cmp : -cmp
  })
  return list
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPage)))
const paginated = computed(() => filtered.value.slice((page.value - 1) * perPage, page.value * perPage))

watch(search, () => { page.value = 1 })

/* ── Sort ────────────────────────────────────────────── */
function toggleSort(key: string) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else { sortKey.value = key; sortAsc.value = true }
}

/* ── CSV import (reads file, passes to store) ────────── */
function handleImport(e: Event, type: 'curated' | 'dlq') {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = (reader.result as string).replace(/\r/g, '')
    const lines = text.trim().split('\n')
    if (lines.length < 2) return
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

    try {
      if (type === 'curated') store.importCurated(headers, lines.slice(1))
      else store.importDlq(headers, lines.slice(1))
    } catch (err: any) {
      alert(err.message || 'Failed to parse CSV.')
    }
    page.value = 1
  }
  reader.readAsText(file)
  input.value = ''
}

/* ── Clear with confirmation ─────────────────────────── */
function confirmClear() {
  if (confirm('Clear all repository data? This removes the imported curated and DLQ data from this session.')) {
    store.clearAll()
    search.value = ''
    page.value = 1
  }
}

/* ── CSV export ──────────────────────────────────────── */
function exportCsv() {
  const exportCols = columns
  const header = exportCols.map(c => c.key).join(',')
  const body = filtered.value.map(r => exportCols.map(c => {
    const v = r[c.key]; return v == null ? '' : String(v).includes(',') ? `"${v}"` : String(v)
  }).join(',')).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'afe_repository_export.csv'; a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.page { width: 1064px; max-width: 1064px; padding: 48px 32px 80px; box-sizing: border-box; }
.page-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
.eyebrow { font-family: 'Inter'; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #94a3b8; }
.page-title { font-family: 'Poppins'; font-size: 30px; font-weight: 800; letter-spacing: -0.6px; color: #0f172a; margin-top: 4px; }
.page-sub { font-size: 14.5px; color: #64748b; max-width: 520px; margin-top: 8px; line-height: 1.6; }
.head-actions { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }

.btn { display: inline-flex; align-items: center; gap: 7px; border: none; border-radius: 12px; padding: 10px 18px; font-family: 'Inter'; font-size: 13.5px; font-weight: 600; cursor: pointer; transition: all .18s ease; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-ic { width: 16px; height: 16px; }
.btn-ghost { background: #fff; color: #475569; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
.btn-ghost:not(:disabled):hover { background: #f8fafc; }
.btn-danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
.btn-danger:not(:disabled):hover { background: #fee2e2; }

/* Warning banners */
.warn-banner { display: flex; align-items: center; gap: 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 14px 18px; margin-bottom: 18px; font-size: 13.5px; color: #92400e; line-height: 1.5; }
.warn-banner--soft { background: #f8fafc; border-color: #e2e8f0; color: #64748b; }
.warn-ic { width: 20px; height: 20px; flex-shrink: 0; }

/* Scorecard */
.scorecard-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.sc-card { background: #fff; border-radius: 20px; padding: 20px 22px; box-shadow: 0 4px 16px rgba(0,0,0,.04); position: relative; overflow: hidden; }
.sc-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--platform); opacity: .7; }
.warn-card { background: #fffbeb; }
.warn-card::before { background: #f59e0b; opacity: .9; }
.sc-label { font-family: 'Inter'; font-size: 11px; font-weight: 600; letter-spacing: .4px; text-transform: uppercase; color: #94a3b8; display: block; }
.sc-val { font-size: 28px; font-weight: 800; color: #0f172a; margin-top: 6px; display: block; letter-spacing: -0.5px; }
.num-font { font-family: 'Inter', monospace; }

/* Table card */
.card { position: relative; background: #fff; border-radius: 24px; box-shadow: 0 8px 32px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.03); padding: 28px; margin-bottom: 24px; overflow: hidden; }
.card-bar { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--platform); opacity: .85; }

.table-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.search-wrap { position: relative; flex: 1; max-width: 400px; }
.search-ic { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 17px; height: 17px; color: #94a3b8; }
.search-input { width: 100%; padding: 10px 14px 10px 38px; border: 1px solid #e2e8f0; border-radius: 12px; font-family: 'Inter'; font-size: 13.5px; color: #1e293b; background: #fcfcfd; outline: none; transition: border .2s; }
.search-input:focus { border-color: #fca5a5; }
.search-input::placeholder { color: #cbd5e1; }
.result-count { font-family: 'Inter'; font-size: 12px; font-weight: 600; color: #94a3b8; }

.table-scroll { overflow-x: auto; margin: 0 -28px; padding: 0 28px; }
.repo-table { width: 100%; border-collapse: collapse; min-width: 1200px; }
.repo-table th { text-align: left; font-family: 'Inter'; font-size: 10.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #94a3b8; padding: 0 10px 10px; border-bottom: 2px solid #f1f5f9; white-space: nowrap; }
.sortable-th { cursor: pointer; user-select: none; }
.sortable-th:hover { color: #ef4444; }
.sort-ic { width: 14px; height: 14px; vertical-align: middle; margin-left: 2px; }
.repo-table td { padding: 11px 10px; border-bottom: 1px solid #f8fafc; font-size: 13px; color: #1e293b; white-space: nowrap; position: relative; }
.repo-table tbody tr:hover { background: #fffaf9; }
.cell-empty { color: #cbd5e1; font-style: italic; }
.cell-flagged { background: #fff7ed; }
.flag-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; margin-right: 5px; vertical-align: middle; }
.flag-dot--legend { margin-right: 6px; }
.legend { display: flex; align-items: center; margin-top: 16px; font-family: 'Inter'; font-size: 12px; color: #94a3b8; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 20px; }
.pg-btn { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid #e2e8f0; background: #fff; border-radius: 10px; cursor: pointer; color: #64748b; transition: all .15s; }
.pg-btn:hover:not(:disabled) { background: #f8fafc; }
.pg-btn:disabled { opacity: .4; cursor: not-allowed; }
.pg-btn :deep(svg) { width: 16px; height: 16px; }
.pg-info { font-size: 13px; font-weight: 600; color: #64748b; }

@media (max-width: 900px) { .page { width: 100%; } .scorecard-row { grid-template-columns: repeat(2, 1fr); } }
</style>
