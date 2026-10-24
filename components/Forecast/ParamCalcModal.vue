<template>
  <Transition name="modal">
    <div v-if="modelValue" class="modal-overlay" @click.self="onSkip">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="param-modal-title">
        
        <!-- Header -->
        <div class="modal-header">
          <div class="header-content">
            <div class="header-icon-wrap">
              <Icon name="heroicons:calculator-20-solid" class="header-icon" />
            </div>
            <div>
              <h3 id="param-modal-title" class="modal-title">Project Parameters & Calculation</h3>
              <p class="modal-subtitle">Configure offshore project parameters or proceed with cached baseline data</p>
            </div>
          </div>
          <button class="modal-close-btn" type="button" @click="onSkip" title="Skip and close">&times;</button>
        </div>

        <!-- Body -->
        <div class="modal-body">

          <!-- Section 1: General Project Configuration -->
          <div class="form-section">
            <h4 class="section-title">Project Configuration</h4>
            <div class="grid-2col">
              
              <!-- Project Year -->
              <div class="form-group">
                <label for="modal-year" class="form-label">Project Year <span class="required">*</span></label>
                <div class="select-wrap">
                  <select
                    id="modal-year"
                    class="form-select year-select"
                    :value="store.navParams.projectYear ?? ''"
                    @change="onYearChange"
                  >
                    <option value="">Select Year</option>
                    <option v-for="yr in projectYearOptions" :key="yr" :value="yr">
                      {{ yr }}
                    </option>
                  </select>
                  <Icon name="heroicons:chevron-down-20-solid" class="select-chevron" />
                </div>
              </div>

              <!-- Legs Configuration -->
              <div class="form-group">
                <label for="modal-legs" class="form-label">Structure Legs <span class="required">*</span></label>
                <div class="select-wrap">
                  <select
                    id="modal-legs"
                    class="form-select"
                    :value="store.navParams.legs"
                    @change="onLegsChange"
                  >
                    <option value="">Select Legs</option>
                    <option value="2">2 Legs</option>
                    <option value="3">3 Legs</option>
                    <option value="4">4 Legs</option>
                    <option value="6">6 Legs</option>
                  </select>
                  <Icon name="heroicons:chevron-down-20-solid" class="select-chevron" />
                </div>
              </div>

            </div>
          </div>

          <!-- Section 2: KKKS Operator & Modifier -->
          <div class="form-section">
            <h4 class="section-title">KKKS Operator Adjustment</h4>
            <div class="grid-2col align-end">
              
              <!-- KKKS Dropdown -->
              <div class="form-group">
                <label for="modal-kkks" class="form-label">KKKS Operator</label>
                <div class="select-wrap">
                  <select
                    id="modal-kkks"
                    class="form-select"
                    :value="store.selectedKkks || ''"
                    @change="onKkksChange"
                  >
                    <option value="">No KKKS selected (None)</option>
                    <option v-for="kkks in sortedKkksList" :key="kkks" :value="kkks">
                      {{ kkks }}
                    </option>
                  </select>
                  <Icon name="heroicons:chevron-down-20-solid" class="select-chevron" />
                </div>
              </div>

              <!-- Modifier Mode Segmented Toggle -->
              <div class="form-group">
                <label class="form-label">Deviation Mode</label>
                <div class="segmented-toggle" role="group" aria-label="KKKS Modifier Mode">
                  <button
                    v-for="opt in modeOptions"
                    :key="opt.value"
                    type="button"
                    class="toggle-btn"
                    :class="{
                      'is-active': (store.kkksModifierMode || 'none') === opt.value,
                      'is-disabled': opt.value !== 'none' && !hasSelectedKkks
                    }"
                    :disabled="opt.value !== 'none' && !hasSelectedKkks"
                    @click="setModifierMode(opt.value)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

            </div>
          </div>

          <!-- Section 3: Dimensions & Structure Weights -->
          <div class="form-section">
            <h4 class="section-title">Dimensions & Tonnage Parameters</h4>
            
            <div class="grid-3col">
              <!-- Water Depth -->
              <div class="form-group">
                <label for="modal-depth" class="form-label">Water Depth <span class="required">*</span></label>
                <div class="input-wrap">
                  <input
                    id="modal-depth"
                    type="number"
                    min="0"
                    placeholder="e.g. 75"
                    class="form-input num-font"
                    :value="store.navParams.waterDepth ?? ''"
                    @input="onNumInput('waterDepth', $event)"
                  />
                  <span class="input-unit">m</span>
                </div>
              </div>

              <!-- Pipeline Length -->
              <div class="form-group">
                <label for="modal-length" class="form-label">Pipeline Length <span class="required">*</span></label>
                <div class="input-wrap">
                  <input
                    id="modal-length"
                    type="number"
                    min="0"
                    placeholder="e.g. 25"
                    class="form-input num-font"
                    :value="store.navParams.pipeLength ?? ''"
                    @input="onNumInput('pipeLength', $event)"
                  />
                  <span class="input-unit">km</span>
                </div>
              </div>

              <!-- Pipeline Diameter -->
              <div class="form-group">
                <label for="modal-diameter" class="form-label">Pipeline Diameter <span class="required">*</span></label>
                <div class="input-wrap">
                  <input
                    id="modal-diameter"
                    type="number"
                    min="0"
                    placeholder="e.g. 16"
                    class="form-input num-font"
                    :value="store.navParams.pipeDiameter ?? ''"
                    @input="onNumInput('pipeDiameter', $event)"
                  />
                  <span class="input-unit">in</span>
                </div>
              </div>
            </div>

            <div class="grid-4col mt-3">
              <!-- Topside -->
              <div class="form-group">
                <label for="modal-topside" class="form-label">Topside Weight <span class="required">*</span></label>
                <div class="input-wrap">
                  <input
                    id="modal-topside"
                    type="number"
                    min="0"
                    placeholder="e.g. 1200"
                    class="form-input num-font"
                    :value="store.navParams.topside ?? ''"
                    @input="onNumInput('topside', $event)"
                  />
                  <span class="input-unit">ton</span>
                </div>
              </div>

              <!-- Jacket -->
              <div class="form-group">
                <label for="modal-jacket" class="form-label">Jacket Weight <span class="required">*</span></label>
                <div class="input-wrap">
                  <input
                    id="modal-jacket"
                    type="number"
                    min="0"
                    placeholder="e.g. 850"
                    class="form-input num-font"
                    :value="store.navParams.jacket ?? ''"
                    @input="onNumInput('jacket', $event)"
                  />
                  <span class="input-unit">ton</span>
                </div>
              </div>

              <!-- Piles -->
              <div class="form-group">
                <label for="modal-piles" class="form-label">Piles Weight <span class="required">*</span></label>
                <div class="input-wrap">
                  <input
                    id="modal-piles"
                    type="number"
                    min="0"
                    placeholder="e.g. 600"
                    class="form-input num-font"
                    :value="store.navParams.piles ?? ''"
                    @input="onNumInput('piles', $event)"
                  />
                  <span class="input-unit">ton</span>
                </div>
              </div>

              <!-- Conductor -->
              <div class="form-group">
                <label for="modal-conductor" class="form-label">Conductor Weight <span class="required">*</span></label>
                <div class="input-wrap">
                  <input
                    id="modal-conductor"
                    type="number"
                    min="0"
                    placeholder="e.g. 300"
                    class="form-input num-font"
                    :value="store.navParams.conductor ?? ''"
                    @input="onNumInput('conductor', $event)"
                  />
                  <span class="input-unit">ton</span>
                </div>
              </div>
            </div>

          </div>

          <!-- Calculation Error Notification if any -->
          <div v-if="calcError" class="error-banner">
            <Icon name="heroicons:exclamation-triangle-20-solid" class="error-icon" />
            <span>{{ calcError }}</span>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="modal-footer">
          <button
            type="button"
            class="btn-secondary"
            :disabled="isCalculating"
            @click="onSkip"
          >
            Skip Calculation (Use Cached Data)
          </button>
          
          <button
            type="button"
            class="btn-primary"
            :class="{ 'btn-primary--loading': isCalculating }"
            :disabled="!canCalc || isCalculating"
            @click="onCalculate"
          >
            <Icon v-if="!isCalculating" name="heroicons:calculator-20-solid" class="btn-icon" />
            <Icon v-else name="heroicons:arrow-path-20-solid" class="btn-icon spin" />
            <span>{{ isCalculating ? 'Calculating Forecast...' : 'Calculate' }}</span>
          </button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useForecastStore } from '~/composables/useForecastStore'
import { useKkksDeviations } from '~/composables/useKkksDeviations'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'skip'): void
  (e: 'calculated'): void
}>()

const store = useForecastStore()
const { kkksList } = useKkksDeviations()

const isCalculating = ref(false)
const calcError = ref<string | null>(null)

// Project Year Options
const projectYearOptions = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

// KKKS Lists & Modes
const sortedKkksList = computed(() => [...kkksList.value].sort((a, b) => a.localeCompare(b)))
const hasSelectedKkks = computed(() => !!store.selectedKkks)

type KkksModifierMode = 'none' | 'median' | 'mean'
const modeOptions: { label: string; value: KkksModifierMode }[] = [
  { label: 'None',   value: 'none' },
  { label: 'Median', value: 'median' },
  { label: 'Mean',   value: 'mean' },
]

const onYearChange = (e: Event) => {
  const raw = (e.target as HTMLSelectElement).value
  const val = raw === '' ? null : Number(raw)
  store.setNavParams({ projectYear: val })
}

const onLegsChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value as '2' | '3' | '4' | '6' | ''
  store.setNavParams({ legs: val })
}

const onKkksChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  if (!val) {
    if (typeof store.setSelectedKkks === 'function') {
      store.setSelectedKkks(null)
    } else {
      store.selectedKkks = null
      store.kkksModifierMode = 'none'
    }
  } else {
    if (typeof store.setSelectedKkks === 'function') {
      store.setSelectedKkks(val)
    } else {
      store.selectedKkks = val
    }
  }
}

const setModifierMode = (mode: KkksModifierMode) => {
  if (mode !== 'none' && !hasSelectedKkks.value) return
  if (typeof store.setKkksModifierMode === 'function') {
    store.setKkksModifierMode(mode)
  } else {
    store.kkksModifierMode = mode
  }
}

const onNumInput = (
  field: 'waterDepth' | 'pipeLength' | 'pipeDiameter' | 'topside' | 'jacket' | 'piles' | 'conductor',
  e: Event
) => {
  const raw = (e.target as HTMLInputElement).value
  const val = raw === '' ? null : Number(raw)
  store.setNavParams({ [field]: val })
}

// Validation check: all 9 params must be provided
const canCalc = computed(() => {
  const p = store.navParams
  return (
    p.waterDepth !== null && p.waterDepth >= 0 &&
    p.pipeLength !== null && p.pipeLength >= 0 &&
    p.pipeDiameter !== null && p.pipeDiameter > 0 &&
    p.topside !== null && p.topside >= 0 &&
    p.jacket !== null && p.jacket >= 0 &&
    p.piles !== null && p.piles >= 0 &&
    p.conductor !== null && p.conductor >= 0 &&
    p.legs !== '' &&
    p.projectYear !== null
  )
})

const onSkip = () => {
  emit('update:modelValue', false)
  emit('skip')
}

const onCalculate = async () => {
  if (!canCalc.value || isCalculating.value) return
  isCalculating.value = true
  calcError.value = null

  try {
    const p = store.navParams
    const payload = {
      leg: Number(p.legs),
      water_depth: Number(p.waterDepth),
      pipe_length: Number(p.pipeLength),
      pipe_diameter: Number(p.pipeDiameter),
      piles: Number(p.piles),
      jacket: Number(p.jacket),
      topside: Number(p.topside),
      conductor: Number(p.conductor),
      project_year: Number(p.projectYear),
    }

    const response = await $fetch<any>('/api/new_forecast_api', {
      method: 'POST',
      body: payload
    })

    if (response && response.success) {
      if (typeof store.applyForecastResult === 'function') {
        store.applyForecastResult(response)
      } else {
        store.summaryFindings = response.summaryFindings
        store.componentFindings = response.componentFindings
        store.computedJson = response
        store.calcDone = true
        if (typeof store.generateInsights === 'function') store.generateInsights()
        if (typeof store.generateNarrative === 'function') store.generateNarrative()
      }
      emit('update:modelValue', false)
      emit('calculated')
    } else {
      calcError.value = response?.error || 'Failed to compute forecast calculations.'
    }
  } catch (err: any) {
    console.error('Failed to run offshore forecast API calculation from modal:', err)
    calcError.value = err?.data?.statusMessage || err?.message || 'Failed to calculate forecast.'
  } finally {
    isCalculating.value = false
  }
}
</script>

<style scoped>
/* Modal overlay & container */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.modal-card {
  background-color: #ffffff;
  border-radius: 20px;
  width: 100%;
  max-width: 680px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 90vh;
  animation: modalScaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 22px 28px 18px;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fee2e2, #fecdd3);
  color: #e11d48;
  flex-shrink: 0;
}

.header-icon {
  width: 24px;
  height: 24px;
}

.modal-title {
  font-size: 19px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 3px 0;
  letter-spacing: -0.3px;
}

.modal-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s;
}

.modal-close-btn:hover {
  color: #0f172a;
  background: #f1f5f9;
}

/* Body & Sections */
.modal-body {
  padding: 22px 28px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #94a3b8;
  margin: 0;
}

/* Form Groups & Grids */
.grid-2col {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.grid-3col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.grid-4col {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.align-end {
  align-items: flex-end;
}

.mt-3 {
  margin-top: 10px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 2px;
}

.required {
  color: #ef4444;
}

/* Selects */
.select-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.form-select {
  width: 100%;
  appearance: none;
  padding: 9px 32px 9px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  background-color: #f8fafc;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  outline: none;
  transition: all 0.2s;
}

.form-select:hover {
  border-color: #94a3b8;
}

.form-select:focus {
  border-color: #f43f5e;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.12);
}

.select-chevron {
  position: absolute;
  right: 10px;
  width: 16px;
  height: 16px;
  color: #94a3b8;
  pointer-events: none;
}

/* Segmented Toggle */
.segmented-toggle {
  display: inline-flex;
  align-items: center;
  background: #f1f5f9;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
  width: 100%;
  box-sizing: border-box;
}

.toggle-btn {
  flex: 1;
  border: none;
  background: transparent;
  padding: 6px 8px;
  border-radius: 8px;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.toggle-btn:hover:not(:disabled):not(.is-active) {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.65);
}

.toggle-btn.is-active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 700;
}

.toggle-btn:disabled,
.toggle-btn.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Numeric Inputs */
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  padding: 9px 36px 9px 12px;
  border: 1.5px solid #cbd5e1;
  border-radius: 10px;
  background-color: #f8fafc;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  outline: none;
  transition: all 0.2s;
  -moz-appearance: textfield;
}

.form-input::-webkit-outer-spin-button,
.form-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.form-input:hover {
  border-color: #94a3b8;
}

.form-input:focus {
  border-color: #f43f5e;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.12);
}

.input-unit {
  position: absolute;
  right: 10px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  pointer-events: none;
}

.num-font {
  font-family: var(--font-number, 'Inter', sans-serif);
}

/* Error Banner */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #b91c1c;
  font-size: 12.5px;
  font-weight: 500;
}

.error-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* Footer Actions */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 18px 28px;
  background: #fafbfc;
  border-top: 1px solid #f1f5f9;
}

.btn-secondary {
  padding: 10px 18px;
  background-color: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 99px;
  color: #475569;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #f1f5f9;
  border-color: #94a3b8;
  color: #0f172a;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  background: linear-gradient(135deg, #fb7185, #e11d48);
  border: none;
  border-radius: 99px;
  color: #ffffff;
  font-family: 'Poppins', sans-serif;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25);
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #f43f5e, #be123c);
  box-shadow: 0 6px 16px rgba(225, 29, 72, 0.35);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  background: #e2e8f0;
  color: #94a3b8;
  box-shadow: none;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  width: 17px;
  height: 17px;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Modal Vue transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
