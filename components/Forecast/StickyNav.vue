<template>
  <div
    class="sticky-nav-wrapper"
    :class="{ 'nav-hidden': isHidden, 'nav-visible': !isHidden }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="sticky-nav-inner">

      <!-- ── YEAR SELECTS (Cost Basis Year & Forecast Year - Custom Checkbox Dropdown) ── -->
      <div class="nav-group year-dropdown-wrap" ref="dropdownRef">
        <button
          id="nav-years-btn"
          type="button"
          class="nav-dropdown year-nav-btn"
          @click="toggleDropdown"
        >
          <span>{{ yearsBtnLabel }}</span>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </button>

        <div v-if="isOpen" class="years-dropdown-panel">
          <!-- Cost Base Section -->
          <div class="dropdown-section">
            <span class="section-title">Cost Base</span>
            <div class="options-list">
              <label v-for="yr in costBasisOptions" :key="yr" class="option-label">
                <input
                  type="checkbox"
                  :checked="isCostBaseSelected(yr)"
                  @change="toggleCostBase(yr)"
                  class="custom-cb"
                />
                <span class="option-text">{{ yr }}</span>
              </label>
            </div>
          </div>
          
          <div class="dropdown-divider"></div>
          
          <!-- Forecast Section -->
          <div class="dropdown-section">
            <span class="section-title">Forecast Year</span>
            <div class="options-list">
              <label v-for="yr in forecastYearOptions" :key="yr" class="option-label">
                <input
                  type="checkbox"
                  :checked="isForecastSelected(yr)"
                  @change="toggleForecast(yr)"
                  class="custom-cb"
                />
                <span class="option-text">{{ yr }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="nav-divider"></div>

      <!-- ── INPUT FIELDS: Depth / P.Length / Topside / Jacket (Individual Bubbles) ── -->
      <div class="nav-group input-bubbles-group">
        <input
          id="nav-depth"
          type="number"
          class="nav-input-bubble"
          placeholder="Depth"
          min="0"
          :value="store.navParams.waterDepth ?? ''"
          @input="onNumInput('waterDepth', $event)"
        />
        <input
          id="nav-length"
          type="number"
          class="nav-input-bubble"
          placeholder="P.Length"
          min="0"
          :value="store.navParams.pipeLength ?? ''"
          @input="onNumInput('pipeLength', $event)"
        />
        <input
          id="nav-topside"
          type="number"
          class="nav-input-bubble"
          placeholder="Topside"
          min="0"
          :value="store.navParams.topside ?? ''"
          @input="onNumInput('topside', $event)"
        />
        <input
          id="nav-jacket"
          type="number"
          class="nav-input-bubble"
          placeholder="Jacket"
          min="0"
          :value="store.navParams.jacket ?? ''"
          @input="onNumInput('jacket', $event)"
        />
      </div>

      <div class="nav-divider"></div>

      <!-- ── DROPDOWN SELECTS ── -->
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

        <!-- Proj. Location -->
        <div class="dropdown-wrap location-dropdown-wrap">
          <select
            id="nav-location"
            class="nav-dropdown location-nav-select"
            :value="store.navParams.projectLocation"
            @change="onLocationChange"
          >
            <option v-for="loc in store.locations" :key="loc" :value="loc">
              {{ loc }}
            </option>
          </select>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </div>
      </div>

      <div class="nav-divider"></div>

      <!-- ── ACTION BUTTONS ── -->
      <div class="nav-group nav-actions">
        <button
          id="nav-calc-btn"
          class="calc-btn"
          :class="{ 'calc-btn--ready': canCalc }"
          :disabled="!canCalc"
          @click="runCalc"
        >
          <Icon name="heroicons:calculator-20-solid" class="calc-icon" />
          <span>Calc.</span>
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
      </div>

    </div>
  </div>

  <!-- PDF Export Modal -->
  <PdfModal v-model="showPdfModal" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useForecastStore } from '~/composables/useForecastStore'
import PdfModal from '~/components/Forecast/PdfModal.vue'

const showPdfModal = ref(false)
const store = useForecastStore()

// ── CUSTOM CHECKBOX DROPDOWN LOGIC ──
const dropdownRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const costBasisOptions = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026']
const forecastYearOptions = ['2026', '2027', '2028', '2029', '2030']

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const isCostBaseSelected = (yr: string) => {
  const selected = store.navParams.costBaseYear ? store.navParams.costBaseYear.split(',').map(s => s.trim()) : []
  return selected.includes(yr)
}

const toggleCostBase = (yr: string) => {
  let selected = store.navParams.costBaseYear ? store.navParams.costBaseYear.split(',').map(s => s.trim()) : []
  if (selected.includes(yr)) {
    selected = selected.filter(s => s !== yr)
  } else {
    selected.push(yr)
  }
  store.setNavParams({ costBaseYear: selected.join(', ') })
}

const isForecastSelected = (yr: string) => {
  const selected = store.navParams.forecastYear ? store.navParams.forecastYear.split(',').map(s => s.trim()) : []
  return selected.includes(yr)
}

const toggleForecast = (yr: string) => {
  let selected = store.navParams.forecastYear ? store.navParams.forecastYear.split(',').map(s => s.trim()) : []
  if (selected.includes(yr)) {
    selected = selected.filter(s => s !== yr)
  } else {
    selected.push(yr)
  }
  store.setNavParams({ forecastYear: selected.join(', ') })
}

const formatYearsLabel = (selectedStr: string) => {
  if (!selectedStr) return '—'
  const years = selectedStr.split(',').map(s => s.trim()).filter(Boolean)
  if (years.length === 0) return '—'
  if (years.length === 1) return years[0]
  // Sort numerically to get the earliest year
  const sorted = years.map(Number).sort((a, b) => a - b)
  return `${sorted[0]} + ${sorted.length - 1}..`
}

const yearsBtnLabel = computed(() => {
  const cb = formatYearsLabel(store.navParams.costBaseYear)
  const fy = formatYearsLabel(store.navParams.forecastYear)
  return `${cb} | ${fy}`
})

const handleClickOutside = (e: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

// ── INPUT HANDLERS ──────────────────────────────────────────────────────────
const onNumInput = (field: 'waterDepth' | 'pipeLength' | 'topside' | 'jacket', e: Event) => {
  const raw = (e.target as HTMLInputElement).value
  const val = raw === '' ? null : Number(raw)
  store.setNavParams({ [field]: val })
}

const onLegsChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value as '2' | '3' | '4' | '6' | ''
  store.setNavParams({ legs: val })
}

const onLocationChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  // Keep both navParams.projectLocation and selectedLocation in sync
  store.setNavParams({ projectLocation: val })
  store.selectedLocation = val
}

// ── CALC GATE ───────────────────────────────────────────────────────────────
// Calc is enabled when key numeric fields have been filled
const canCalc = computed(() => {
  const p = store.navParams
  return (
    p.waterDepth !== null && p.waterDepth > 0 &&
    p.pipeLength !== null && p.pipeLength > 0 &&
    p.legs !== '' &&
    p.projectLocation !== ''
  )
})

const runCalc = async () => {
  if (!canCalc.value) return
  store.runCalc()
}

// ── SCROLL HIDE / SHOW LOGIC ──
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

// Mouse near top of viewport → reveal
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
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('click', handleClickOutside)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style scoped>
/* ─── WRAPPER ─────────────────────────────────────────── */
.sticky-nav-wrapper {
  margin-top:-2px;
  position: fixed;
  top: 0;
  justify-self:center;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border: 2px solid rgba(255, 153, 153, 0.397);
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.06);
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease;
  will-change: transform;
  border-radius:0 0 12px 12px;
}


.nav-visible {
  transform: translateY(0);
  opacity: 1;
}

.nav-hidden {
  transform: translateY(-110%);
  opacity: 0;
}

/* ─── INNER ROW ───────────────────────────────────────── */
.sticky-nav-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 12px 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  justify-content:center;
}

/* ─── GROUPS ──────────────────────────────────────────── */
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

/* ─── YEAR SELECTS ────────────────────────────────────── */
.year-select-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  position: relative;
}

.year-label {
  font-family: 'Poppins', sans-serif;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #94a3b8;
  line-height: 1;
}

.year-basis .year-select {
  background: linear-gradient(135deg, #fda4af, #fb7185);
  color: #fff;
  border: none;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
}

.year-forecast .year-select {
  background: linear-gradient(135deg, #fecdd3, #fda4af);
  color: #fff;
  border: none;
  font-weight: 700;
  font-family: 'Inter', sans-serif;
}

.year-select {
  appearance: none;
  cursor: pointer;
  padding: 5px 14px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 700;
  outline: none;
  text-align: center;
  min-width: 80px;
  transition: opacity 0.15s;
}
.year-select:hover { opacity: 0.85; }

/* ─── INPUT BUBBLES GROUP ─────────────────────────────── */
.input-bubbles-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.nav-input-bubble {
  width: 72px;
  padding: 7px 6px;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  font-family: 'Inter', sans-serif;
  font-size: 12.5px;
  font-weight: 600;
  color: #334155;
  outline: none;
  text-align: center;
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
  -moz-appearance: textfield;
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
  font-size: 11.5px;
}

.nav-input-bubble:hover {
  border-color: #94a3b8;
}

.nav-input-bubble:focus {
  border-color: #fb923c;
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.12);
  background: #ffffff;
}

/* ─── CUSTOM YEARS DROPDOWN ───────────────────────────── */
.year-dropdown-wrap {
  position: relative;
}

.year-nav-btn {
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  min-width: 170px;
  text-align: left;
}

.years-dropdown-panel {
  position: absolute;
  top: 115%;
  left: 0;
  min-width: 210px;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  z-index: 1010;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dropdown-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section-title {
  font-family: 'Poppins', sans-serif;
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 2px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.option-label:hover {
  color: #fb923c;
}

.custom-cb {
  width: 14px;
  height: 14px;
  accent-color: #fb923c;
  cursor: pointer;
}

.dropdown-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 4px 0;
}

/* ─── DROPDOWN SELECTS ────────────────────────────────── */
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

/* Location dropdown styling */
.location-dropdown-wrap .nav-dropdown {
  border-color: #cbd5e1;
  font-weight: 600;
  font-family: 'Poppins', sans-serif;
  min-width: 140px;
}

.location-dropdown-wrap .nav-dropdown:hover {
  border-color: #fb923c;
}

.location-dropdown-wrap .nav-dropdown:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
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

/* ─── ACTION BUTTONS ──────────────────────────────────── */
.nav-actions {
  gap: 6px;
}

/* ── Calc button ── */
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

.calc-icon {
  width: 15px;
  height: 15px;
}

/* ── PDF button ── */
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

/* ─── FADE TRANSITION ─────────────────────────────────── */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
