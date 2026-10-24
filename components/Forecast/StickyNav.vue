<template>
  <div
    class="sticky-nav-wrapper"
    :class="{ 'nav-hidden': isHidden, 'nav-visible': !isHidden }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="sticky-nav-inner">

      <!--  PROJECT YEAR SELECT  -->
      <div class="nav-group">
        <div class="dropdown-wrap year-dropdown-wrap">
          <select
            id="nav-year"
            class="nav-dropdown year-nav-select"
            :value="store.navParams.projectYear ?? ''"
            @change="onYearChange"
          >
            <option value="">Year</option>
            <option v-for="yr in projectYearOptions" :key="yr" :value="yr">
              {{ yr }}
            </option>
          </select>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </div>
      </div>

      <div class="nav-divider"></div>

      <!--  INPUT FIELDS: Depth / P.Length / P.Dia / Topside / Jacket / Piles / Conductor (Individual Bubbles with Units)  -->
      <div class="nav-group input-bubbles-group">
        <div class="nav-input-bubble-wrap" title="Water Depth (m)">
          <input
            id="nav-depth"
            type="number"
            class="nav-input-bubble"
            :class="{ 'has-value': hasVal(store.navParams.waterDepth) }"
            placeholder="Depth"
            min="0"
            :value="store.navParams.waterDepth ?? ''"
            @input="onNumInput('waterDepth', $event)"
          />
          <span v-if="hasVal(store.navParams.waterDepth)" class="nav-input-unit">m</span>
        </div>

        <div class="nav-input-bubble-wrap" title="Pipeline Length (km)">
          <input
            id="nav-length"
            type="number"
            class="nav-input-bubble"
            :class="{ 'has-value': hasVal(store.navParams.pipeLength) }"
            placeholder="P.Len"
            min="0"
            :value="store.navParams.pipeLength ?? ''"
            @input="onNumInput('pipeLength', $event)"
          />
          <span v-if="hasVal(store.navParams.pipeLength)" class="nav-input-unit">km</span>
        </div>

        <div class="nav-input-bubble-wrap" title="Pipeline Diameter (in)">
          <input
            id="nav-diameter"
            type="number"
            class="nav-input-bubble"
            :class="{ 'has-value': hasVal(store.navParams.pipeDiameter) }"
            placeholder="P.Dia"
            min="0"
            :value="store.navParams.pipeDiameter ?? ''"
            @input="onNumInput('pipeDiameter', $event)"
          />
          <span v-if="hasVal(store.navParams.pipeDiameter)" class="nav-input-unit">in</span>
        </div>

        <div class="nav-input-bubble-wrap" title="Topside Weight (ton)">
          <input
            id="nav-topside"
            type="number"
            class="nav-input-bubble nav-input-bubble--ton"
            :class="{ 'has-value': hasVal(store.navParams.topside) }"
            placeholder="Topside"
            min="0"
            :value="store.navParams.topside ?? ''"
            @input="onNumInput('topside', $event)"
          />
          <span v-if="hasVal(store.navParams.topside)" class="nav-input-unit">ton</span>
        </div>

        <div class="nav-input-bubble-wrap" title="Jacket Weight (ton)">
          <input
            id="nav-jacket"
            type="number"
            class="nav-input-bubble nav-input-bubble--ton"
            :class="{ 'has-value': hasVal(store.navParams.jacket) }"
            placeholder="Jacket"
            min="0"
            :value="store.navParams.jacket ?? ''"
            @input="onNumInput('jacket', $event)"
          />
          <span v-if="hasVal(store.navParams.jacket)" class="nav-input-unit">ton</span>
        </div>

        <div class="nav-input-bubble-wrap" title="Piles Weight (ton)">
          <input
            id="nav-piles"
            type="number"
            class="nav-input-bubble nav-input-bubble--ton"
            :class="{ 'has-value': hasVal(store.navParams.piles) }"
            placeholder="Piles"
            min="0"
            :value="store.navParams.piles ?? ''"
            @input="onNumInput('piles', $event)"
          />
          <span v-if="hasVal(store.navParams.piles)" class="nav-input-unit">ton</span>
        </div>

        <div class="nav-input-bubble-wrap" title="Conductor Weight (ton)">
          <input
            id="nav-conductor"
            type="number"
            class="nav-input-bubble nav-input-bubble--ton"
            :class="{ 'has-value': hasVal(store.navParams.conductor) }"
            placeholder="Cond."
            min="0"
            :value="store.navParams.conductor ?? ''"
            @input="onNumInput('conductor', $event)"
          />
          <span v-if="hasVal(store.navParams.conductor)" class="nav-input-unit">ton</span>
        </div>
      </div>

      <div class="nav-divider"></div>

      <!--  DROPDOWN SELECTS  -->
      <div class="nav-group">
        <!-- Legs Configuration -->
        <div class="dropdown-wrap">
          <select
            id="nav-legs"
            class="nav-dropdown"
            :value="store.navParams.legs"
            @change="onLegsChange"
          >
            <option value="">Legs</option>
            <option value="2">2 Legs</option>
            <option value="3">3 Legs</option>
            <option value="4">4 Legs</option>
            <option value="6">6 Legs</option>
          </select>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </div>

        <!-- KKKS Dropdown & Attached Info Button (Unified Split Control) -->
        <div class="kkks-select-wrap" :class="{ 'kkks-select-wrap--has-value': hasSelectedKkks }">
          <div class="dropdown-wrap kkks-dropdown-wrap">
            <select
              id="nav-kkks"
              class="nav-dropdown kkks-nav-select"
              :value="store.selectedKkks || ''"
              @change="onKkksChange"
              title="Select KKKS Operator"
            >
              <option value="">No KKKS selected</option>
              <option v-for="kkks in sortedKkksList" :key="kkks" :value="kkks">
                {{ kkks }}
              </option>
            </select>
            <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron kkks-dropdown-chevron" />
          </div>

          <!-- Info button integrated into the right segment of the unified pill -->
          <button
            id="nav-kkks-info-btn"
            type="button"
            class="kkks-info-btn"
            :disabled="!hasSelectedKkks"
            :class="{ 'kkks-info-btn--active': hasSelectedKkks }"
            title="KKKS Modifier Details"
            @click="onKkksInfoClick"
          >
            <Icon name="heroicons:information-circle-20-solid" class="info-btn-icon" />
          </button>
        </div>

        <!-- Segmented three-way toggle: None | Median | Mean -->
        <div class="kkks-segmented-toggle" role="group" aria-label="KKKS Modifier Mode">
          <button
            v-for="opt in modeOptions"
            :key="opt.value"
            type="button"
            class="toggle-segment-btn"
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

      <div class="nav-divider"></div>

      <!--  ACTION BUTTONS  -->
      <div class="nav-group nav-actions">
        <button
          id="nav-calc-btn"
          class="calc-btn"
          :class="{ 'calc-btn--ready': canCalc && !isCalculating, 'calc-btn--loading': isCalculating }"
          :disabled="!canCalc || isCalculating"
          @click="runCalc"
        >
          <Icon v-if="!isCalculating" name="heroicons:calculator-20-solid" class="calc-icon" />
          <Icon v-else name="heroicons:arrow-path-20-solid" class="calc-icon calc-spin" />
          <span>{{ isCalculating ? 'Calc...' : 'Calc.' }}</span>
        </button>
        <button
          id="nav-pdf-btn"
          class="pdf-btn"
          :class="{ 'pdf-btn--active': store.calcDone }"
          :disabled="!store.calcDone"
          @click="showPdfModal = true"
          :title="store.calcDone ? 'Generate PDF Report' : 'Run Calc. first to unlock PDF'"
        >
          <Icon name="heroicons:document-arrow-down-20-solid" class="pdf-icon" />
          <span class="pdf-label">PDF</span>
        </button>
        <button
          id="nav-reset-comparation-btn"
          type="button"
          class="reset-btn"
          :class="{ 'reset-btn--active': hasComparationValues }"
          :disabled="!hasComparationValues"
          title="Reset Comparation Values"
          @click="resetComparation"
        >
          <Icon name="heroicons:trash-20-solid" class="reset-icon" />
        </button>
      </div>

    </div>
  </div>

  <!-- PDF Export Modal -->
  <PdfModal v-model="showPdfModal" />

  <!-- KKKS Detail Modal -->
  <KkksDetailModal
    v-model="showKkksModal"
    :kkks-name="store.selectedKkks"
    :active-mode="(store.kkksModifierMode || 'none') as 'none' | 'median' | 'mean'"
  />

  <!-- Initial Onboarding Step 1: Parameter & Calculation Modal (Navbar functions) -->
  <ParamCalcModal
    v-model="showParamModal"
    @skip="onParamModalDone"
    @calculated="onParamModalDone"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useForecastStore } from '~/composables/useForecastStore'
import { useKkksDeviations } from '~/composables/useKkksDeviations'
import PdfModal from '~/components/Forecast/PdfModal.vue'
import KkksDetailModal from '~/components/Forecast/KkksDetailModal.vue'
import ParamCalcModal from '~/components/Forecast/ParamCalcModal.vue'

const showPdfModal = ref(false)
const showKkksModal = ref(false)
const showParamModal = ref(true)
const store = useForecastStore()
const { kkksList } = useKkksDeviations()

const onParamModalDone = () => {
  showParamModal.value = false
  store.openComparationModal()
}

//  COMPARATION RESET 
const hasComparationValues = computed(() => {
  if (!store.comparationInputs) return false
  return Object.values(store.comparationInputs).some(v => v !== null && v !== undefined && (v as any) !== '')
})

const resetComparation = () => {
  if (typeof store.setComparationInputs === 'function') {
    store.setComparationInputs({})
  } else {
    store.comparationInputs = {}
  }
}

//  KKKS CONTROLS 
const sortedKkksList = computed(() => [...kkksList.value].sort((a, b) => a.localeCompare(b)))

const hasSelectedKkks = computed(() => !!store.selectedKkks)

type KkksModifierMode = 'none' | 'median' | 'mean'

const modeOptions: { label: string; value: KkksModifierMode }[] = [
  { label: 'None',   value: 'none' },
  { label: 'Median', value: 'median' },
  { label: 'Mean',   value: 'mean' },
]

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

const onKkksInfoClick = () => {
  if (!hasSelectedKkks.value) return
  showKkksModal.value = true
}

//  PROJECT YEAR OPTIONS 
const hasVal = (v: any) => v !== null && v !== undefined && v !== ''
const projectYearOptions = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

const onYearChange = (e: Event) => {
  const raw = (e.target as HTMLSelectElement).value
  const val = raw === '' ? null : Number(raw)
  store.setNavParams({ projectYear: val })
}

//  INPUT HANDLERS 
const onNumInput = (
  field: 'waterDepth' | 'pipeLength' | 'pipeDiameter' | 'topside' | 'jacket' | 'piles' | 'conductor',
  e: Event
) => {
  const raw = (e.target as HTMLInputElement).value
  const val = raw === '' ? null : Number(raw)
  store.setNavParams({ [field]: val })
}

const onLegsChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value as '2' | '3' | '4' | '6' | ''
  store.setNavParams({ legs: val })
}

//  CALC GATE 
// Calc is enabled when key numeric fields have been filled
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

const isCalculating = ref(false)

const runCalc = async () => {
  if (!canCalc.value || isCalculating.value) return
  isCalculating.value = true
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
    }
  } catch (err: any) {
    console.error('Failed to run offshore forecast API calculation:', err)
    alert(err?.data?.statusMessage || err?.message || 'Failed to calculate forecast')
  } finally {
    isCalculating.value = false
  }
}

//  SCROLL HIDE / SHOW LOGIC 
const isHidden = ref(false)
let lastScrollY = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null
let isMouseOver = false

const handleScroll = () => {
  const currentY = window.scrollY
  const delta = currentY - lastScrollY

  if (delta > 6 && currentY > 80) {
    if (!isMouseOver) {
      isHidden.value = true
    }
  } else if (delta < -4) {
    isHidden.value = false
  }

  lastScrollY = currentY
}

// Mouse near top of viewport  reveal
const handleMouseMove = (e: MouseEvent) => {
  if (e.clientY < 12) {
    isHidden.value = false
  }
}

const onMouseEnter = () => {
  isMouseOver = true
  isHidden.value = false
}

const onMouseLeave = () => {
  isMouseOver = false
}

onMounted(() => {
  lastScrollY = window.scrollY
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('mousemove', handleMouseMove, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('mousemove', handleMouseMove)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style scoped>
/*  WRAPPER  */
.sticky-nav-wrapper {
  margin-top: -2px;
  position: fixed;
  top: 0;
  justify-self: center;
  z-index: 1000;
  max-width: 100vw;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 2px solid rgba(255, 153, 153, 0.397);
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.06);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease;
  will-change: transform;
  border-radius: 0 0 12px 12px;
}

.sticky-nav-wrapper::-webkit-scrollbar {
  display: none;
}


.nav-visible {
  transform: translateY(0);
  opacity: 1;
}

.nav-hidden {
  transform: translateY(-110%);
  opacity: 0;
}

/*  INNER ROW  */
.sticky-nav-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 28px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  justify-content: center;
}

/*  GROUPS  */
.nav-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.nav-divider {
  width: 1px;
  height: 28px;
  background: #e2e8f0;
  flex-shrink: 0;
  border-radius: 1px;
}

/*  INPUT BUBBLES GROUP  */
.input-bubbles-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-input-bubble-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 35px;
}

.nav-input-bubble {
  width: 58px;
  height: 35px;
  box-sizing: border-box;
  padding: 7px 6px;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  outline: none;
  text-align: left;
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
  -moz-appearance: textfield;
}

.nav-input-bubble--ton {
  width: 70px;
}

.nav-input-bubble.has-value {
  padding-right: 14px;
  padding-left: 6px;
  background: #ffffff;
  color: #0f172a;
}

.nav-input-bubble--ton.has-value {
  padding-right: 21px;
}

.nav-input-bubble::-webkit-outer-spin-button,
.nav-input-bubble::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.nav-input-bubble::placeholder {
  color: #94a3b8;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
  font-size: 11px;
  text-align: left;
}

.nav-input-bubble:hover {
  border-color: #94a3b8;
}

.nav-input-bubble:focus {
  border-color: #fb923c;
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.12);
  background: #ffffff;
}

.nav-input-unit {
  position: absolute;
  right: 5px;
  font-size: 9.5px;
  font-weight: 700;
  color: #94a3b8;
  pointer-events: none;
  user-select: none;
  line-height: 1;
}

.nav-input-bubble:focus + .nav-input-unit {
  color: #ea580c;
}

/*  DROPDOWN SELECTS  */
.dropdown-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.nav-dropdown {
  appearance: none;
  padding: 7px 32px 7px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 99px;
  background-color: #f8fafc;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  outline: none;
  white-space: nowrap;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.nav-dropdown:hover {
  border-color: #94a3b8;
}

.nav-dropdown:focus {
  border-color: #fb923c;
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.12);
  background: #fff;
}

.dropdown-chevron {
  position: absolute;
  right: 10px;
  width: 14px;
  height: 14px;
  color: #94a3b8;
  pointer-events: none;
  flex-shrink: 0;
}

/* Year dropdown styling */
.year-dropdown-wrap .nav-dropdown {
  background: linear-gradient(135deg, #fda4af, #fb7185);
  color: #fff;
  border: none;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  min-width: 100px;
}

.year-dropdown-wrap .nav-dropdown:hover {
  opacity: 0.85;
}

.year-dropdown-wrap .nav-dropdown:focus {
  box-shadow: 0 0 0 3px rgba(251, 113, 133, 0.25);
}

.year-dropdown-wrap .dropdown-chevron {
  color: rgba(255, 255, 255, 0.8);
}

.year-dropdown-wrap .nav-dropdown option {
  background: #ffffff;
  color: #334155;
}

/* ── KKKS UNIFIED SPLIT BUTTON CONTROL ─────────────────────── */
.kkks-select-wrap {
  display: inline-flex;
  align-items: stretch;
  background-color: #f8fafc;
  border: 1.5px solid #cbd5e1;
  border-radius: 99px;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
  height: 35px;
}

.kkks-select-wrap:hover {
  border-color: #94a3b8;
}

.kkks-select-wrap:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background-color: #ffffff;
}

.kkks-select-wrap--has-value {
  border-color: #cbd5e1;
}

.kkks-dropdown-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
}

.kkks-dropdown-wrap .nav-dropdown.kkks-nav-select {
  border: none;
  background: transparent;
  border-radius: 99px 0 0 99px;
  padding: 6px 26px 6px 14px;
  min-width: 120px;
  max-width: 180px;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: none;
  outline: none;
  height: 100%;
}

.kkks-dropdown-chevron {
  right: 8px;
}

.kkks-info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: none;
  border-left: 1px solid #e2e8f0;
  background: transparent;
  color: #94a3b8;
  cursor: not-allowed;
  opacity: 0.45;
  transition: background 0.18s ease, color 0.18s ease, opacity 0.18s ease;
  flex-shrink: 0;
  border-radius: 0 99px 99px 0;
  outline: none;
}

.kkks-info-btn--active {
  cursor: pointer;
  opacity: 1;
  color: #2563eb;
  background: #eff6ff;
}

.kkks-info-btn--active:hover {
  background: #dbeafe;
  color: #1d4ed8;
}

.kkks-info-btn--active:focus-visible {
  background: #dbeafe;
}

.info-btn-icon {
  width: 16px;
  height: 16px;
}

/*  SEGMENTED THREE-WAY TOGGLE  */
.kkks-segmented-toggle {
  display: inline-flex;
  align-items: center;
  background: #f1f5f9;
  border: 1.5px solid #e2e8f0;
  border-radius: 99px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.toggle-segment-btn {
  border: none;
  background: transparent;
  padding: 4px 10px;
  border-radius: 99px;
  font-family: 'Poppins', sans-serif;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.2;
  user-select: none;
  white-space: nowrap;
}

.toggle-segment-btn:hover:not(:disabled):not(.is-active) {
  color: #0f172a;
  background: rgba(255, 255, 255, 0.65);
}

.toggle-segment-btn.is-active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 700;
}

.toggle-segment-btn:disabled,
.toggle-segment-btn.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
  color: #94a3b8;
}

/* Scenario dropdown */
.scenario-dropdown-wrap .nav-dropdown {
  border-color: #cbd5e1;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  min-width: 130px;
}

.scenario-dropdown-wrap .nav-dropdown:not(:disabled):hover {
  border-color: #10b981;
}

.scenario-dropdown-wrap .nav-dropdown:not(:disabled):focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
}

/* Loading spinner */
.nav-spinner-wrap {
  display: flex;
  align-items: center;
}

.nav-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: nav-spin 0.7s linear infinite;
}

@keyframes nav-spin {
  to { transform: rotate(360deg); }
}

/*  ACTION BUTTONS  */
.nav-actions {
  gap: 6px;
}

/*  Calc button  */
.calc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: 99px;
  background: #e2e8f0;
  color: #94a3b8;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 700;
  cursor: not-allowed;
  opacity: 0.7;
  outline: none;
  transition: background 0.2s, color 0.2s, opacity 0.2s, box-shadow 0.2s;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.calc-btn--ready {
  background: var(--platform2);
  color: #040101;
  cursor: pointer;
  opacity: 1;
}

.calc-btn--ready:hover {
  box-shadow: 0 4px 14px rgba(239, 68, 68, 0.28);
  transform: translateY(-1px);
}

.calc-btn--loading {
  background: var(--platform2);
  color: #040101;
  opacity: 0.85;
  cursor: wait;
}

.calc-spin {
  animation: nav-spin 0.8s linear infinite;
}

.calc-icon {
  width: 15px;
  height: 15px;
}

/*  PDF button  */
.pdf-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 99px;
  background: #f8fafc;
  color: #b0bec5;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 700;
  cursor: not-allowed;
  opacity: 0.55;
  outline: none;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.pdf-btn--active {
  border-color: #f28080;
  color: #ee6b6b;
  background: #fff;
  cursor: pointer;
  opacity: 1;
}

.pdf-btn--active:hover {
  background: #fff5f5;
  box-shadow: 0 3px 12px rgba(239, 68, 68, 0.18);
  transform: translateY(-1px);
}

.pdf-icon {
  width: 15px;
  height: 15px;
}

.pdf-label {
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/*  Reset Comparation button (trash icon only)  */
.reset-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
  box-sizing: border-box;
  border: 1.5px solid #e2e8f0;
  border-radius: 99px;
  background: #f8fafc;
  color: #b0bec5;
  cursor: not-allowed;
  opacity: 0.5;
  outline: none;
  transition: all 0.2s ease;
  padding: 0;
  flex-shrink: 0;
}

.reset-btn--active {
  border-color: #fca5a5;
  color: #ef4444;
  background: #ffffff;
  cursor: pointer;
  opacity: 1;
}

.reset-btn--active:hover {
  background: #fef2f2;
  border-color: #ef4444;
  color: #dc2626;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.16);
  transform: translateY(-1px);
}

.reset-icon {
  width: 16px;
  height: 16px;
}

/*  FADE TRANSITION  */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/*  RESPONSIVE & MOBILE / NARROW WIDTHS  */
@media (max-width: 1100px) {
  .sticky-nav-inner {
    padding: 10px 16px;
    gap: 6px;
    justify-content: flex-start;
  }
  .kkks-dropdown-wrap .nav-dropdown {
    min-width: 140px;
    max-width: 175px;
  }
}

@media (max-width: 640px) {
  .sticky-nav-inner {
    padding: 8px 12px;
  }
  .toggle-segment-btn {
    padding: 3px 6px;
    font-size: 10px;
  }
}
</style>
