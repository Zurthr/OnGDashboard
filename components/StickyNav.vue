<template>
  <div
    class="sticky-nav-wrapper"
    :class="{ 'nav-hidden': isHidden, 'nav-visible': !isHidden }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="sticky-nav-inner">

      <!-- ── YEAR SELECTS (Cost Basis Year & Forecast Year) ── -->
      <div class="nav-group">
        <div class="year-select-wrap year-basis">
          <select class="year-select" disabled>
            <option>2020–2024</option>
          </select>
          <span class="year-label">Cost Base</span>
        </div>

        <div class="year-select-wrap year-forecast">
          <select class="year-select" disabled>
            <option>2028</option>
          </select>
          <span class="year-label">Forecast</span>
        </div>
      </div>

      <div class="nav-divider"></div>

      <!-- ── NUMERICAL INPUTS ── -->
      <div class="nav-group">
        <div class="num-input-wrap">
          <input type="number" class="num-input" placeholder="Depth" disabled />
        </div>
        <div class="num-input-wrap">
          <input type="number" class="num-input" placeholder="Length" disabled />
        </div>
      </div>

      <div class="nav-divider"></div>

      <!-- ── DROPDOWN SELECTS ── -->
      <div class="nav-group">
        <!-- Legs -->
        <div class="dropdown-wrap">
          <select class="nav-dropdown" disabled>
            <option value="">Legs</option>
            <option>[Choice 1]</option>
            <option>[Choice 2]</option>
            <option>[Choice 3]</option>
            <option>[Choice 4]</option>
            <option>[Choice 5]</option>
          </select>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </div>

        <!-- Umbilical Slot -->
        <div class="dropdown-wrap">
          <select class="nav-dropdown" disabled>
            <option value="">Umbilical Slot</option>
            <option>[Choice 1]</option>
            <option>[Choice 2]</option>
            <option>[Choice 3]</option>
            <option>[Choice 4]</option>
            <option>[Choice 5]</option>
          </select>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </div>

        <!-- Installation Method -->
        <div class="dropdown-wrap">
          <select class="nav-dropdown" disabled>
            <option value="">Installation Method</option>
            <option>[Choice 1]</option>
            <option>[Choice 2]</option>
            <option>[Choice 3]</option>
            <option>[Choice 4]</option>
            <option>[Choice 5]</option>
          </select>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </div>

        <!-- Proj. Location -->
        <div class="dropdown-wrap">
          <select class="nav-dropdown" disabled>
            <option value="">Proj. Location</option>
            <option>[Choice 1]</option>
            <option>[Choice 2]</option>
            <option>[Choice 3]</option>
            <option>[Choice 4]</option>
            <option>[Choice 5]</option>
          </select>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </div>
      </div>

      <div class="nav-divider"></div>

      <!-- ── SCENARIO SELECT ── -->
      <div class="nav-group">
        <div class="dropdown-wrap scenario-dropdown-wrap">
          <select
            class="nav-dropdown scenario-nav-select"
            v-model="scenarioId"
            @change="onScenarioChange"
            :disabled="store.loadingDetails || store.loadingScenarios"
          >
            <option v-if="store.scenarios.length === 0" :value="null" disabled>No scenarios</option>
            <option v-for="id in store.scenarios" :key="id" :value="id">
              Scenario #{{ id }}
            </option>
          </select>
          <Icon name="heroicons:chevron-down-20-solid" class="dropdown-chevron" />
        </div>

        <!-- Loading spinner inside scenario group -->
        <transition name="fade">
          <div v-if="store.loadingDetails || store.loadingScenarios" class="nav-spinner-wrap">
            <div class="nav-spinner"></div>
          </div>
        </transition>
      </div>

      <div class="nav-divider"></div>

      <!-- ── ACTION BUTTONS ── -->
      <div class="nav-group nav-actions">
        <button class="calc-btn" disabled>
          <Icon name="heroicons:calculator-20-solid" class="calc-icon" />
          <span>Calc.</span>
        </button>
        <button class="pdf-btn" disabled>
          <Icon name="heroicons:document-arrow-down-20-solid" class="pdf-icon" />
          <span class="pdf-label">PDF</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

const store = useVedaStore()
const scenarioId = ref<number | null>(null)

// Keep local scenario in sync with store
watch(() => store.selectedScenarioId, (val) => {
  if (val !== null) scenarioId.value = val
}, { immediate: true })

const onScenarioChange = () => {
  if (scenarioId.value !== null) {
    store.selectScenario(scenarioId.value)
  }
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
    // Scrolling down → schedule hide (slight delay so fast flicks don't flash)
    if (!isMouseOver) {
      isHidden.value = true
    }
  } else if (delta < -4) {
    // Scrolling up → reveal immediately
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
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('mousemove', handleMouseMove)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<style scoped>
/* ─── WRAPPER ─────────────────────────────────────────── */
.sticky-nav-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  /* Frosted glass background */
  background: rgba(255, 255, 255, 0.88);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.06);
  /* Smooth slide transition */
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease;
  will-change: transform;
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
  padding: 10px 28px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  overflow-x: auto;
}

/* Hide scrollbar on the inner row */
.sticky-nav-inner::-webkit-scrollbar { display: none; }
.sticky-nav-inner { -ms-overflow-style: none; scrollbar-width: none; }

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
  cursor: not-allowed;
  padding: 5px 14px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 700;
  outline: none;
  text-align: center;
  min-width: 80px;
}

/* ─── NUMERICAL INPUTS ────────────────────────────────── */
.num-input-wrap {
  display: flex;
  align-items: center;
}

.num-input {
  width: 76px;
  padding: 7px 12px;
  border: 1.5px solid #e2e8f0;
  border-radius: 99px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  background: #f8fafc;
  outline: none;
  text-align: center;
  cursor: not-allowed;
  transition: border-color 0.2s;
}

.num-input::placeholder {
  color: #94a3b8;
  font-family: 'Poppins', sans-serif;
  font-weight: 500;
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
  background-color: #ffffff;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  cursor: not-allowed;
  outline: none;
  white-space: nowrap;
  transition: border-color 0.2s;
}

.nav-dropdown:not(:disabled):hover {
  border-color: #94a3b8;
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

/* Scenario dropdown — slightly wider, active style */
.scenario-dropdown-wrap .nav-dropdown {
  cursor: pointer;
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
  margin-left: auto;
  gap: 6px;
}

.calc-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: 99px;
  background: linear-gradient(135deg, #fb923c, #ef4444);
  color: #ffffff;
  font-family: 'Poppins', sans-serif;
  font-size: 13px;
  font-weight: 700;
  cursor: not-allowed;
  opacity: 0.6;
  outline: none;
  transition: none;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.calc-icon {
  width: 15px;
  height: 15px;
}

.pdf-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border: 2px solid #ef4444;
  border-radius: 99px;
  background: #fff;
  color: #ef4444;
  font-family: 'Poppins', sans-serif;
  font-size: 12px;
  font-weight: 700;
  cursor: not-allowed;
  opacity: 0.55;
  outline: none;
  white-space: nowrap;
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
