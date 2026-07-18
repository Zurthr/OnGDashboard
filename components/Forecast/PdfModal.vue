<template>
  <!-- Backdrop -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-backdrop" @click.self="$emit('update:modelValue', false)">
        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header-left">
              <div class="modal-icon-wrap">
                <Icon name="heroicons:document-arrow-down-20-solid" class="modal-icon" />
              </div>
              <div>
                <h2 id="modal-title" class="modal-title">Generate Regulatory Report</h2>
                <p class="modal-subtitle">Select which visualizations to include in the report.</p>
              </div>
            </div>
            <button class="modal-close-btn" @click="$emit('update:modelValue', false)" :disabled="generating">
              <Icon name="heroicons:x-mark-20-solid" class="modal-close-icon" />
            </button>
          </div>

          <!-- Visualization toggles -->
          <div class="modal-section">
            <span class="modal-section-label">Visualizations</span>
            <div class="viz-grid">
              <button
                v-for="viz in vizOptions"
                :key="viz.id"
                class="viz-card"
                :class="{ 'viz-card--selected': selected.includes(viz.id) }"
                @click="toggleViz(viz.id)"
                :disabled="generating"
              >
                <div class="viz-check">
                  <Icon
                    :name="selected.includes(viz.id) ? 'heroicons:check-circle-20-solid' : 'heroicons:circle-20-solid'"
                    class="check-icon"
                    :class="{ 'check-icon--active': selected.includes(viz.id) }"
                  />
                </div>
                <div class="viz-icon-wrap">
                  <Icon :name="viz.icon" class="viz-icon" />
                </div>
                <span class="viz-name">{{ viz.name }}</span>
                <span class="viz-desc">{{ viz.desc }}</span>
              </button>
            </div>
          </div>

          <!-- Summary type selection -->
          <div class="modal-section" style="margin-top: 20px;">
            <span class="modal-section-label">Summary Content Type</span>
            <div class="summary-toggle-group">
              <div
                class="summary-card"
                :class="{
                  'summary-card--selected': summaryType === 'narrative',
                  'summary-card--disabled': generating
                }"
                @click="!generating && (summaryType = 'narrative')"
              >
                <div class="summary-details">
                  <span class="summary-title">AI Cost Narrative</span>
                  <span class="summary-desc">Include formal AI narrative page</span>
                </div>
                <input
                  type="radio"
                  class="summary-radio"
                  :checked="summaryType === 'narrative'"
                  :disabled="generating"
                  readonly
                />
              </div>

              <div
                class="summary-card"
                :class="{
                  'summary-card--selected': summaryType === 'insights',
                  'summary-card--disabled': generating
                }"
                @click="!generating && (summaryType = 'insights')"
              >
                <div class="summary-details">
                  <span class="summary-title">Deterministic Insights</span>
                  <span class="summary-desc">Include rule-based summary insights</span>
                </div>
                <input
                  type="radio"
                  class="summary-radio"
                  :checked="summaryType === 'insights'"
                  :disabled="generating"
                  readonly
                />
              </div>
            </div>
          </div>

          <!-- Report metadata preview -->
          <div class="modal-meta">
            <div class="meta-item">
              <Icon name="heroicons:calendar-days-20-solid" class="meta-icon" />
              <span>{{ today }}</span>
            </div>
            <div class="meta-item">
              <Icon name="heroicons:document-text-20-solid" class="meta-icon" />
              <span>Scenario #{{ store.selectedScenarioId ?? '—' }}</span>
            </div>
            <div class="meta-item">
              <Icon name="heroicons:chart-bar-20-solid" class="meta-icon" />
              <span>{{ selected.length }} visualization{{ selected.length !== 1 ? 's' : '' }} selected</span>
            </div>
          </div>

          <!-- Generate button -->
          <div class="modal-footer">
            <button
              class="generate-btn"
              :class="{ 'generate-btn--loading': generating }"
              :disabled="generating || selected.length === 0"
              @click="generatePdf"
            >
              <template v-if="!generating">
                <Icon name="heroicons:document-arrow-down-20-solid" class="btn-icon" />
                Generate PDF Report
              </template>
              <template v-else>
                <span class="spinner"></span>
                Generating report…
              </template>
            </button>
            <p class="modal-note">
              Report is generated from verified analytical data. Generation may take a few seconds.
            </p>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: boolean): void }>()

const store = useVedaStore()
const generating = ref(false)
const summaryType = ref<'narrative' | 'insights'>('narrative')

// ── Viz options ───────────────────────────────────────────────────────────
const vizOptions = [
  {
    id: 'location',
    name: 'Location Map',
    desc: 'Operation site & geo context',
    icon: 'heroicons:map-pin-20-solid',
  },
  {
    id: 'variance',
    name: 'Variance Charts',
    desc: 'Forecast vs baseline breakdown',
    icon: 'heroicons:chart-bar-20-solid',
  },
  {
    id: 'treemap',
    name: 'Treemap',
    desc: 'Cost composition distribution',
    icon: 'heroicons:squares-2x2-20-solid',
  },
]

// All selected by default
const selected = ref<string[]>(['location', 'variance', 'treemap'])

const toggleViz = (id: string) => {
  if (selected.value.includes(id)) {
    selected.value = selected.value.filter(s => s !== id)
  } else {
    selected.value = [...selected.value, id]
  }
}

// ── Today's date label ────────────────────────────────────────────────────
const today = computed(() => {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
})

// ── PDF generation ────────────────────────────────────────────────────────
const generatePdf = async () => {
  if (generating.value || selected.value.length === 0) return
  generating.value = true

  try {
    const response = await $fetch<Blob>('/api/generate-report', {
      method: 'POST',
      responseType: 'blob',
      body: {
        scenarioId: store.selectedScenarioId,
        summaryFindings: store.summaryFindings,
        componentFindings: store.componentFindings,
        insights: store.insights,
        narrative: store.narrative,
        useNarrative: summaryType.value === 'narrative',
        selectedVisualizations: selected.value,
        scenarioParams: {
          forecastYear:        store.navParams.forecastYear || '2028',
          historicalBasis:     store.navParams.costBaseYear || '2020–2024',
          projectLocation:     store.navParams.projectLocation || store.selectedLocation || '—',
          waterDepth:          store.navParams.waterDepth ?? undefined,
          structureLength:     store.navParams.pipeLength ?? undefined,
          legsConfiguration:   store.navParams.legs || undefined,
          topsideWeight:       store.navParams.topside ?? undefined,
          jacketWeight:        store.navParams.jacket ?? undefined,
        },
      }
    })

    // Trigger browser download
    const sanitizedLoc = (store.selectedLocation || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    const reportFilename = `report-${sanitizedLoc}-2028-${Date.now()}.pdf`

    const url = URL.createObjectURL(response as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = reportFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    emit('update:modelValue', false)
  } catch (err) {
    console.error('PDF generation failed:', err)
    alert('PDF generation failed. Please try again.')
  } finally {
    generating.value = false
  }
}
</script>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 23, 42, 0.45);
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
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.18);
  width: 100%;
  max-width: 580px;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
}

/* ── Header ───────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 24px 0;
  gap: 12px;
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.modal-icon-wrap {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #fee2e2, #fef3c7);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-icon {
  width: 20px; height: 20px;
  color: #ef4444;
}

.modal-title {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 2px;
  letter-spacing: -0.3px;
}

.modal-subtitle {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.modal-close-btn {
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.modal-close-btn:hover { background: #e2e8f0; }
.modal-close-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.modal-close-icon { width: 16px; height: 16px; color: #64748b; }

/* ── Section ──────────────────────────────────────────────────── */
.modal-section {
  padding: 20px 24px 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-section-label {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

/* ── Viz grid ─────────────────────────────────────────────────── */
.viz-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.viz-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px 14px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.18s ease;
  text-align: center;
  font-family: inherit;
}

.viz-card:hover:not(:disabled) {
  border-color: #fca5a5;
  background: #fff5f5;
  transform: translateY(-1px);
}

.viz-card--selected {
  border-color: #ef4444;
  background: linear-gradient(160deg, #fff5f5 0%, #fef9f0 100%);
  box-shadow: 0 2px 10px rgba(239, 68, 68, 0.1);
}

.viz-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.viz-check {
  position: absolute;
  top: 8px;
  right: 8px;
}

.check-icon {
  width: 18px; height: 18px;
  color: #cbd5e1;
  transition: color 0.15s;
}

.check-icon--active {
  color: #ef4444;
}

.viz-icon-wrap {
  width: 44px; height: 44px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 2px;
}

.viz-card--selected .viz-icon-wrap {
  background: #fee2e2;
  border-color: #fecaca;
}

.viz-icon {
  width: 22px; height: 22px;
  color: #94a3b8;
  transition: color 0.15s;
}

.viz-card--selected .viz-icon { color: #ef4444; }

.viz-name {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}

.viz-desc {
  font-size: 10px;
  color: #94a3b8;
  line-height: 1.3;
}

/* ── Meta row ─────────────────────────────────────────────────── */
.modal-meta {
  display: flex;
  gap: 16px;
  padding: 16px 24px 0;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: #64748b;
  font-weight: 500;
}

.meta-icon {
  width: 13px; height: 13px;
  color: #94a3b8;
  flex-shrink: 0;
}

/* ── Footer ───────────────────────────────────────────────────── */
.modal-footer {
  padding: 20px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.generate-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 13px 20px;
  background: linear-gradient(133deg, #FC7A7A -2.89%, #FC7A7A 6.11%, #FFBDBD 43.99%, #FAFEA6 104.99%);
  color: #261812;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.2);
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.28);
}

.generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.generate-btn--loading {
  background: #f1f5f9;
  color: #64748b;
  box-shadow: none;
}

.btn-icon { width: 16px; height: 16px; }

/* Spinner */
.spinner {
  width: 16px; height: 16px;
  border: 2.5px solid #cbd5e1;
  border-top-color: #ef4444;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.modal-note {
  font-size: 11px;
  color: #94a3b8;
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

/* ── Transition ────────────────────────────────────────────────── */
.modal-fade-enter-active { transition: all 0.22s ease; }
.modal-fade-leave-active { transition: all 0.18s ease; }
.modal-fade-enter-from  { opacity: 0; }
.modal-fade-leave-to    { opacity: 0; }
.modal-fade-enter-from .modal-card { transform: scale(0.96) translateY(8px); }
.modal-fade-leave-to   .modal-card { transform: scale(0.96) translateY(8px); }

/* ── Summary Type selection ──────────────────────────────────── */
.summary-toggle-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 10px;
}

.summary-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.summary-card:hover:not(.summary-card--disabled) {
  border-color: #fca5a5;
  background: #fff5f5;
  transform: translateY(-1px);
}

.summary-card--selected {
  border-color: #ef4444;
  background: linear-gradient(160deg, #fff5f5 0%, #fef9f0 100%);
  box-shadow: 0 2px 10px rgba(239, 68, 68, 0.1);
}

.summary-card--disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.summary-radio {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 18px;
  height: 18px;
  accent-color: #ef4444;
  cursor: pointer;
}

.summary-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.summary-title {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}

.summary-card--selected .summary-title {
  color: #ef4444;
}

.summary-desc {
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
}
</style>
