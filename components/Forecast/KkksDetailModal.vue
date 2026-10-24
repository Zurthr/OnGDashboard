<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="modal-backdrop"
        @click.self="close"
        role="presentation"
      >
        <div
          ref="modalCardRef"
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kkks-modal-title"
          tabindex="-1"
        >
          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header-left">
              <div class="modal-icon-wrap">
                <Icon name="heroicons:information-circle-20-solid" class="modal-icon" />
              </div>
              <div>
                <div class="title-row">
                  <h2 id="kkks-modal-title" class="modal-title">
                    {{ kkksName || 'KKKS Modifier Details' }}
                  </h2>
                  <span class="mode-badge" :class="`mode-${activeMode}`">
                    Mode: {{ activeMode.toUpperCase() }}
                  </span>
                </div>
                <p class="modal-subtitle">
                  Historical cost deviation metrics and applied modifier status
                </p>
              </div>
            </div>
            <button
              ref="closeBtnRef"
              type="button"
              class="modal-close-btn"
              @click="close"
              aria-label="Close modal"
            >
              <Icon name="heroicons:x-mark-20-solid" class="modal-close-icon" />
            </button>
          </div>

          <!-- Body / Content -->
          <div class="modal-body">
            <!-- Table Section -->
            <div class="table-container">
              <table class="kkks-table" aria-label="KKKS Deviation Table">
                <thead>
                  <tr>
                    <th scope="col">Cost Type</th>
                    <th scope="col" class="text-right">Mean %</th>
                    <th scope="col" class="text-right">Median %</th>
                    <th scope="col" class="text-right">Currently Applied</th>
                    <th scope="col" class="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in tableRows"
                    :key="row.costType"
                    :class="{ 'row-outlier': row.isOutlier }"
                  >
                    <td class="cell-cost-type">
                      <span class="cost-type-name">{{ row.costType }}</span>
                      <span
                        v-if="row.isOutlier"
                        class="outlier-tag"
                        title="Mean and Median differ by >30 percentage points due to outliers"
                      >
                        Outlier Skew ({{ row.diff.toFixed(1) }}pp)
                      </span>
                    </td>
                    <td class="cell-val text-right num-font" :class="getValueClass(row.mean)">
                      {{ formatPct(row.mean) }}
                    </td>
                    <td class="cell-val text-right num-font" :class="getValueClass(row.median)">
                      {{ formatPct(row.median) }}
                    </td>
                    <td class="cell-val text-right num-font cell-applied" :class="getValueClass(row.appliedVal)">
                      {{ row.appliedText }}
                    </td>
                    <td class="text-center">
                      <span class="status-pill" :class="`status-${row.statusKey}`">
                        {{ row.statusLabel }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <span class="footer-hint">
              Values computed from effective historical deviation data.
            </span>
            <button
              type="button"
              class="btn-close-action"
              @click="close"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { useKkksDeviations, CSV_TO_APP_COMPONENT_MAP } from '~/composables/useKkksDeviations'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    kkksName: string | null
    activeMode?: 'none' | 'median' | 'mean'
  }>(),
  {
    activeMode: 'none',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const modalCardRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
let lastActiveElement: HTMLElement | null = null

const { getEffective } = useKkksDeviations()

const costTypes = Object.values(CSV_TO_APP_COMPONENT_MAP)

// Read everything from effective values, not raw CSV
const effectiveData = computed(() => {
  if (!props.kkksName) return null
  return getEffective(props.kkksName)
})

interface TableRow {
  costType: string
  mean: number | null
  median: number | null
  appliedVal: number | null
  appliedText: string
  statusKey: 'adjusted' | 'no-data' | 'out-of-range' | 'inactive'
  statusLabel: string
  isOutlier: boolean
  diff: number
}

const tableRows = computed<TableRow[]>(() => {
  const data = effectiveData.value || {}

  return costTypes.map(costType => {
    const stats = data[costType]
    const mean = stats?.avg ?? null
    const median = stats?.median ?? null

    // Outlier detection: mean and median differ by more than 30 percentage points
    let isOutlier = false
    let diff = 0
    if (mean !== null && median !== null) {
      diff = Math.abs(mean - median)
      isOutlier = diff > 30
    }

    // Currently applied under the active mode
    let appliedVal: number | null = null
    let appliedText = '—'
    let statusKey: TableRow['statusKey'] = 'no-data'
    let statusLabel = 'No data'

    if (props.activeMode === 'none') {
      appliedText = '—'
      statusKey = 'inactive'
      statusLabel = 'Inactive'
    } else {
      appliedVal = props.activeMode === 'median' ? median : mean

      if (appliedVal === null || appliedVal === undefined) {
        appliedText = '—'
        statusKey = 'no-data'
        statusLabel = 'No data'
      } else if (appliedVal <= -100) {
        appliedText = formatPct(appliedVal)
        statusKey = 'out-of-range'
        statusLabel = 'Out of range'
      } else {
        appliedText = formatPct(appliedVal)
        statusKey = 'adjusted'
        statusLabel = 'Adjusted'
      }
    }

    return {
      costType,
      mean,
      median,
      appliedVal,
      appliedText,
      statusKey,
      statusLabel,
      isOutlier,
      diff,
    }
  })
})

function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—'
  const sign = val > 0 ? '+' : ''
  return `${sign}${val.toFixed(2)}%`
}

function getValueClass(val: number | null | undefined): string {
  if (val === null || val === undefined) return 'text-muted'
  if (val > 0) return 'val-positive'
  if (val < 0) return 'val-negative'
  return ''
}

function close() {
  emit('update:modelValue', false)
}

// ── Keyboard Accessibility & Focus Trap ────────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    close()
    return
  }

  if (e.key === 'Tab' && modalCardRef.value) {
    const focusable = modalCardRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first || document.activeElement === modalCardRef.value) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
}

watch(
  () => props.modelValue,
  isOpen => {
    if (isOpen) {
      lastActiveElement = document.activeElement as HTMLElement | null
      window.addEventListener('keydown', handleKeydown)
      nextTick(() => {
        if (closeBtnRef.value) {
          closeBtnRef.value.focus()
        } else if (modalCardRef.value) {
          modalCardRef.value.focus()
        }
      })
    } else {
      window.removeEventListener('keydown', handleKeydown)
      if (lastActiveElement) {
        lastActiveElement.focus()
        lastActiveElement = null
      }
    }
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* ── Card ─────────────────────────────────────────────────────── */
.modal-card {
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22);
  width: 100%;
  max-width: 760px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  outline: none;
}

/* ── Header ───────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 28px 18px;
  border-bottom: 1px solid #f1f5f9;
  gap: 16px;
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.modal-icon-wrap {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #e0f2fe, #dbeafe);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-icon {
  width: 24px;
  height: 24px;
  color: #0284c7;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.modal-title {
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  letter-spacing: -0.3px;
}

.mode-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 9999px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.mode-none {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.mode-median,
.mode-mean {
  background: #e0f2fe;
  color: #0284c7;
  border: 1px solid #bae6fd;
}

.modal-subtitle {
  font-size: 12px;
  color: #64748b;
  margin: 3px 0 0;
}

.modal-close-btn {
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.1s;
}

.modal-close-btn:hover {
  background: #e2e8f0;
}

.modal-close-btn:focus-visible {
  outline: 2px solid #0284c7;
  outline-offset: 2px;
}

.modal-close-icon {
  width: 18px;
  height: 18px;
  color: #64748b;
}

/* ── Body ─────────────────────────────────────────────────────── */
.modal-body {
  padding: 20px 28px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Table ────────────────────────────────────────────────────── */
.table-container {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.kkks-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.kkks-table th {
  background-color: #f8fafc;
  color: #475569;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.6px;
  padding: 10px 14px;
  border-bottom: 1px solid #e2e8f0;
}

.kkks-table td {
  padding: 11px 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}

.kkks-table tr:last-child td {
  border-bottom: none;
}

.kkks-table tr:hover {
  background-color: #f8fafc;
}

/* Outlier row highlighting */
.kkks-table tr.row-outlier {
  background-color: #fffbeb;
}

.kkks-table tr.row-outlier:hover {
  background-color: #fef3c7;
}

.cell-cost-type {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cost-type-name {
  font-weight: 600;
  color: #0f172a;
}

.outlier-tag {
  font-size: 9px;
  font-weight: 700;
  color: #b45309;
  background-color: #fef3c7;
  border: 1px solid #fde68a;
  padding: 1px 5px;
  border-radius: 4px;
  width: fit-content;
}

.cell-val {
  font-size: 13px;
}

.cell-applied {
  font-weight: 700;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.text-muted {
  color: #94a3b8;
}

.val-positive {
  color: #c2410c;
}

.val-negative {
  color: #15803d;
}

/* Status Pills */
.status-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  display: inline-block;
  letter-spacing: 0.3px;
}

.status-adjusted {
  background-color: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.status-no-data {
  background-color: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.status-out-of-range {
  background-color: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.status-inactive {
  background-color: #f8fafc;
  color: #94a3b8;
  border: 1px solid #e2e8f0;
}



/* ── Footer ───────────────────────────────────────────────────── */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  border-top: 1px solid #f1f5f9;
  background: #fafafa;
}

.footer-hint {
  font-size: 11px;
  color: #94a3b8;
}

.btn-close-action {
  background: #0f172a;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-close-action:hover {
  background: #334155;
}

.btn-close-action:focus-visible {
  outline: 2px solid #0284c7;
  outline-offset: 2px;
}

/* ── Transitions ──────────────────────────────────────────────── */
.modal-fade-enter-active {
  transition: opacity 0.22s ease;
}

.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-card,
.modal-fade-leave-to .modal-card {
  transform: scale(0.96) translateY(8px);
}

.modal-card {
  transition: transform 0.22s ease;
}
</style>
