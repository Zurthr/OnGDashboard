<template>
  <div class="dashboard-wrapper" style="margin:0 240 0 0; width:1080px;">
    <div class="container">

      <!-- ===== AT A GLANCE SCORECARD ROW ===== -->
      <div class="at-a-glance-section">
        <h2 class="section-title">At a Glance</h2>
        <div class="scorecard-row">
          <!-- Card 1: Cost Basis (USD) -->
          <div class="scorecard-card neutral-card" style="min-width:164px">
            <span class="card-label">Cost Basis (USD)</span>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
            <span v-else class="card-val num-font">{{ formatCurrency(store.summaryFindings.baselineTotal) }}</span>
            <span class="card-subtitle">
              <span class="subtext-bold">1,097</span> <span class="subtext-unit">US$/ft</span>
            </span>
          </div>

          <!-- Card 2: Forecasted (USD) -->
          <div class="scorecard-card pink-card" style="min-width:164px">
            <span class="card-label">Forecasted (USD)</span>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
            <span v-else class="card-val num-font">{{ formatCurrency(store.summaryFindings.forecastTotal) }}</span>
            <span class="card-subtitle">
              <span class="subtext-bold">1,097</span> <span class="subtext-unit">US$/ft</span>
            </span>
          </div>

          <!-- Card 3: Variance -->
          <div class="scorecard-card variance-card" style="min-width:164px">
            <span class="card-label">Variance</span>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
            <span v-else class="card-val num-font">{{ formatCurrency(store.summaryFindings.absoluteVarianceTotal) }}</span>
            <span class="card-subtitle">
              <span class="subtext-bold">1,097</span> <span class="subtext-unit">US$/ft</span>
            </span>
          </div>

          <!-- Card 4: Deviation of -->
          <div class="scorecard-card neutral-card">
            <span class="card-label">% Deviation</span>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
            <span v-else class="card-val num-font">{{ store.summaryFindings.percentageDeviationTotal }}%</span>
            <div v-if="!store.loadingDetails" class="severity-badge-container">
              <span class="severity-pill" :class="getSeverityBadgeClass(store.summaryFindings.percentageDeviationTotal)">
                {{ getSeverityLabel(store.summaryFindings.percentageDeviationTotal) }}
              </span>
            </div>          
          </div>

          <!-- Card 5: Dominant Driver -->
          <div class="scorecard-card neutral-card">
            <span class="card-label">Dominant Driver</span>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
            <template v-else>
              <span class="card-val num-font">{{ dominantDriverRatio }}%</span>
              <span class="card-subtitle">{{ dominantDriverName }}</span>
            </template>
          </div>

          <!-- Card 6: Historical Status -->
          <div class="scorecard-card neutral-card">
            <span class="card-label">Historical Status</span>
            <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-val-skeleton"></div>
            <template v-else>
              <span class="card-val">{{ historicalStatusLabel }}</span>
              <span class="card-subtitle">Range</span>
            </template>
          </div>
        </div>
      </div>

      <!-- ===== VISUALIZATION PANEL ===== -->
      <div class="visualization-panel">
        <div class="panel-header">
          <span class="panel-title">Visualization: Operation Location</span>
        </div>
        
        <div class="panel-content-card">
          <!-- Active Tab Content -->
          <div v-show="activeTab === 'Location'" class="tab-panel-content">
            <div class="map-container">
              <!-- Leaflet map fills the container -->
              <div id="map-viewport" class="leaflet-map-viewport"></div>

              <!-- Map Details Card Overlay (Bottom Left corner) -->
              <div class="map-info-overlay">
                <span class="overlay-tag">OFFSHORE PROVINCE</span>
                <span class="overlay-location-name">{{ store.selectedLocation }}</span>
                <span class="overlay-coords">{{ getActiveCoords }}</span>
              </div>
            </div>
          </div>

          <!-- Variance Tab Content (Placeholder) -->
          <div v-show="activeTab === 'Variance'" class="tab-panel-content placeholder-tab">
            <div class="coming-soon-wrapper">
              <Icon name="heroicons:chart-bar-20-solid" class="coming-soon-icon" />
              <span class="coming-soon-text">Variance visualization coming soon</span>
            </div>
          </div>

          <!-- Treemap Tab Content (Placeholder) -->
          <div v-show="activeTab === 'Treemap'" class="tab-panel-content placeholder-tab">
            <div class="coming-soon-wrapper">
              <Icon name="heroicons:square-2-stack-20-solid" class="coming-soon-icon" />
              <span class="coming-soon-text">Treemap visualization coming soon</span>
            </div>
          </div>
          
          <!-- Tab Bar (At the bottom of the map panel as shown in screenshot) -->
          <div class="tab-bar-row">
            <div class="tab-buttons">
              <button 
                v-for="tab in ['Location', 'Variance', 'Treemap']" 
                :key="tab"
                class="tab-btn" 
                :class="{ 'active-tab': activeTab === tab }"
                @click="activeTab = tab"
              >
                <span>{{ tab }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== COMPARE RESULTS SECTION ===== -->
      <div class="compare-results-section">

        <!-- Row 0: Section Label -->
        <div class="section-label-row">
          <div class="section-label-block">
            <span class="compare-label">Compare</span>
            <h1 class="results-label">Results</h1>
          </div>
        </div>

        <!-- 3-column grid: Cost Basis | Forecasted | Variance -->
        <div class="results-grid">

          <!-- COL 1: Cost Basis -->
          <div class="col-basis">
            <div class="col-header-block">
              <span class="col-header-label">Cost Basis</span>
              <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
              <span v-else class="col-header-value num-font">{{ formatCurrency(store.summaryFindings.baselineTotal) }}</span>
              <span class="col-header-subtext">
                <span class="subtext-bold num-font">1,097</span> <span class="subtext-unit">US$/ft</span>
              </span>
            </div>

            <!-- Basis Cards -->
            <div class="cards-list">
              <div 
                v-for="finding in store.componentFindings" 
                :key="finding.costType" 
                class="basis-card"
                :class="{ 'dominant-card': finding.isDominantDriver }"
              >
                <div class="card-left">
                  <span class="card-prefix">
                    Total <span v-if="finding.isDominantDriver" class="dominant-prefix">• Dominant</span>
                  </span>
                  <span class="card-name">{{ finding.costType }}</span>
                </div>
                <div class="card-divider"></div>
                <div class="card-right">
                  <span class="card-currency">in USD</span>
                  <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
                  <span v-else class="card-value num-font">{{ formatCurrency(finding.baseline) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- COL 2: Forecasted (red tinted) -->
          <div class="col-forecast">
            <div class="forecast-inner">
              <div class="col-header-block">
                <span class="col-header-label">Forecasted</span>
                <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
                <span v-else class="col-header-value num-font forecast-value-color">{{ formatCurrency(store.summaryFindings.forecastTotal) }}</span>
                <span class="col-header-subtext is-red">
                  <span class="subtext-bold num-font">1,097</span> <span class="subtext-unit">US$/ft</span>
                </span>
              </div>

              <!-- Forecast Cards -->
              <div class="cards-list">
                <div 
                  v-for="finding in store.componentFindings" 
                  :key="finding.costType" 
                  class="forecast-card"
                  :class="{ 'dominant-forecast-card': finding.isDominantDriver }"
                >
                  <div class="card-badge-row">
                    <span class="card-currency">in USD</span>
                    <span v-if="finding.isDominantDriver" class="dominant-tag">DOMINANT DRIVER</span>
                  </div>
                  <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
                  <span v-else class="card-value num-font">{{ formatCurrency(finding.forecast) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- COL 3: Variance (green dashed border) -->
          <div class="col-variance">
            <div class="variance-inner">
              <!-- Variance Header -->
              <div class="variance-header-row">
                <span class="col-header-label variance-label-text">Variance</span>
                <span class="severity-badge" :class="getSeverityClass(store.summaryFindings.percentageDeviationTotal)">
                  {{ getSeverityLabel(store.summaryFindings.percentageDeviationTotal) }}
                </span>
              </div>
              <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse header-skeleton"></div>
              <span v-else class="col-header-value num-font variance-value-color">{{ formatCurrency(store.summaryFindings.absoluteVarianceTotal) }}</span>

              <!-- Variance Sub-columns header -->
              <div class="variance-subheader-row">
                <span class="variance-subcol-label">Amount (USD)</span>
                <span class="variance-subcol-label">in %s</span>
              </div>

              <!-- Variance Cards -->
              <div class="cards-list">
                <div 
                  v-for="finding in store.componentFindings" 
                  :key="finding.costType"
                  class="variance-card-row"
                >
                  <div class="variance-cell variance-cell-amount">
                    <span class="card-currency">in USD</span>
                    <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
                    <span v-else class="card-value num-font" :class="finding.absoluteVariance > 0 ? 'var-positive' : 'var-negative'">
                      {{ formatCurrency(finding.absoluteVariance) }}
                    </span>
                  </div>
                  <div class="variance-cell variance-cell-pct">
                    <div v-if="store.loadingDetails" class="skeleton-bar animate-pulse card-value-skeleton"></div>
                    <span v-else class="pct-value num-font" :class="finding.percentageDeviation > 0 ? 'var-positive' : 'var-negative'">
                      {{ finding.percentageDeviation > 0 ? '+' : '' }}{{ finding.percentageDeviation }}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div><!-- /results-grid -->
      </div><!-- /compare-results-section -->

      <!-- ===== WHAT ARI THINKS ===== -->
      <div class="ari-section">
        <div class="ari-card">
          <!-- Top-left tab header -->
          <div class="ari-header-tab">
            <span class="tab-text">
              What <span class="ari-highlight">Ari <span class="sparkle">✨</span></span> Thinks
            </span>
          </div>

          <!-- Content -->
          <div class="ari-content">
            <!-- Loading skeleton -->
            <div v-if="store.loadingInsights || store.loadingDetails" class="skeleton-wrapper">
              <div class="skeleton-bar animate-pulse" style="width: 100%; height: 16px;"></div>
              <div class="skeleton-bar animate-pulse" style="width: 97%; height: 16px;"></div>
              <div class="skeleton-bar animate-pulse" style="width: 94%; height: 16px;"></div>
              <div class="skeleton-bar animate-pulse" style="width: 90%; height: 16px;"></div>
              <div class="skeleton-bar animate-pulse" style="width: 55%; height: 16px;"></div>
            </div>

            <!-- Error state -->
            <div v-else-if="store.errorInsights" class="ari-error-state">
              <Icon name="heroicons:exclamation-triangle-16-solid" class="ari-error-icon" />
              <span>{{ store.errorInsights }}</span>
            </div>

            <!-- Insights content -->
            <div v-else-if="store.insights" class="insights-text" v-html="formattedInsights"></div>

            <!-- Empty state -->
            <div v-else class="ari-empty-state">
              <p>Select a scenario above to generate Ari's AI analysis.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== DEV TOOLS (Collapsible) ===== -->
      <div class="dev-tools-section">
        <button class="dev-tools-toggle" @click="devToolsOpen = !devToolsOpen">
          <Icon :name="devToolsOpen ? 'heroicons:chevron-up-20-solid' : 'heroicons:chevron-down-20-solid'" class="devtools-toggle-icon" />
          <span>{{ devToolsOpen ? 'Hide' : 'Show' }} Dev Tools</span>
          <span class="dev-tools-badge">Developer</span>
        </button>

        <transition name="slide-fade">
          <div v-if="devToolsOpen" class="dev-tools-content">

            <!-- Scenario Cost Category Breakdown Table -->
            <div class="summary-table-card">
              <div class="card-header">
                <div class="header-titles">
                  <h3 class="table-title">Scenario Cost Category Breakdown</h3>
                  <p class="table-subtitle">Detailed side-by-side comparison of baseline and forecast values</p>
                </div>
                <div v-if="store.selectedScenarioId" class="scenario-badge">
                  Scenario #{{ store.selectedScenarioId }}
                </div>
              </div>
              
              <div class="table-wrapper">
                <table class="cost-table">
                  <thead>
                    <tr>
                      <th class="text-left">Cost Category</th>
                      <th class="text-right">Baseline (USD)</th>
                      <th class="text-right">Forecast (USD)</th>
                      <th class="text-right">Variance (USD)</th>
                      <th class="text-right">Contribution Ratio (%)</th>
                      <th class="text-right">Deviation (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- Loading Skeleton State -->
                    <template v-if="store.loadingDetails">
                      <tr v-for="i in 6" :key="i" class="skeleton-row">
                        <td><div class="skeleton-bar" style="width: 180px; height: 16px;"></div></td>
                        <td><div class="skeleton-bar" style="width: 100px; height: 16px; margin-left: auto;"></div></td>
                        <td><div class="skeleton-bar" style="width: 100px; height: 16px; margin-left: auto;"></div></td>
                        <td><div class="skeleton-bar" style="width: 100px; height: 16px; margin-left: auto;"></div></td>
                        <td><div class="skeleton-bar" style="width: 80px; height: 16px; margin-left: auto;"></div></td>
                        <td><div class="skeleton-bar" style="width: 70px; height: 16px; margin-left: auto;"></div></td>
                      </tr>
                    </template>
                    
                    <!-- Data State -->
                    <template v-else>
                      <tr 
                        v-for="comp in store.componentFindings" 
                        :key="comp.costType" 
                        class="data-row"
                        :class="{ 'dominant-table-row': comp.isDominantDriver }"
                      >
                        <td class="category-name">
                          <div class="category-label-wrapper">
                            <span>{{ comp.costType }}</span>
                            <span v-if="comp.isDominantDriver" class="dominant-table-tag">DOMINANT</span>
                          </div>
                        </td>
                        <td class="text-right num-font">{{ formatCurrency(comp.baseline) }}</td>
                        <td class="text-right num-font">{{ formatCurrency(comp.forecast) }}</td>
                        <td 
                          class="text-right num-font font-semibold"
                          :class="comp.absoluteVariance > 0 ? 'text-red' : comp.absoluteVariance < 0 ? 'text-green' : ''"
                        >
                          {{ comp.absoluteVariance > 0 ? '+' : '' }}{{ formatCurrency(comp.absoluteVariance) }}
                        </td>
                        <td class="text-right num-font">
                          {{ comp.contributionRatio > 0 ? '+' : '' }}{{ comp.contributionRatio }}%
                        </td>
                        <td class="text-right">
                          <span 
                            class="badge num-font"
                            :class="comp.percentageDeviation > 35 ? 'badge-red-bold' : comp.percentageDeviation > 15 ? 'badge-red' : comp.percentageDeviation < -15 ? 'badge-green' : 'badge-gray'"
                          >
                            {{ comp.percentageDeviation > 0 ? '+' : '' }}{{ comp.percentageDeviation }}%
                          </span>
                        </td>
                      </tr>

                      <!-- Total Row -->
                      <tr class="total-row-item">
                        <td class="font-bold">Total Capex Sum</td>
                        <td class="text-right num-font font-bold">{{ formatCostBasisTotal(store.summaryFindings.baselineTotal) }}</td>
                        <td class="text-right num-font font-bold">{{ formatCurrency(store.summaryFindings.forecastTotal) }}</td>
                        <td 
                          class="text-right num-font font-bold"
                          :class="store.summaryFindings.absoluteVarianceTotal > 0 ? 'text-red' : 'text-green'"
                        >
                          {{ store.summaryFindings.absoluteVarianceTotal > 0 ? '+' : '' }}{{ formatCurrency(store.summaryFindings.absoluteVarianceTotal) }}
                        </td>
                        <td class="text-right num-font font-bold">100.00%</td>
                        <td class="text-right">
                          <span 
                            class="badge num-font font-bold"
                            :class="store.summaryFindings.percentageDeviationTotal > 25 ? 'badge-red-bold' : store.summaryFindings.percentageDeviationTotal > 10 ? 'badge-red' : 'badge-gray'"
                          >
                            {{ store.summaryFindings.percentageDeviationTotal > 0 ? '+' : '' }}{{ store.summaryFindings.percentageDeviationTotal }}%
                          </span>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- VEDA JSON Section -->
            <div class="json-card">
              <div class="card-header">
                <div class="header-titles">
                  <h3 class="table-title">VEDA Engine Output JSON</h3>
                  <p class="table-subtitle">Structured computation payload returned by the backend engine</p>
                </div>
                <button 
                  v-if="store.computedJson" 
                  @click="copyJson" 
                  class="copy-btn"
                  :disabled="store.loadingDetails"
                >
                  <Icon :name="copied ? 'heroicons:check-16-solid' : 'heroicons:clipboard-document-16-solid'" class="btn-icon" />
                  <span>{{ copied ? 'Copied!' : 'Copy JSON' }}</span>
                </button>
              </div>

              <div class="code-container">
                <template v-if="store.loadingDetails">
                  <div class="skeleton-code-wrapper animate-pulse">
                    <div class="skeleton-code-line" style="width: 25%"></div>
                    <div class="skeleton-code-line" style="width: 45%"></div>
                    <div class="skeleton-code-line" style="width: 35%"></div>
                    <div class="skeleton-code-line" style="width: 55%"></div>
                    <div class="skeleton-code-line" style="width: 20%"></div>
                    <div class="skeleton-code-line" style="width: 75%"></div>
                    <div class="skeleton-code-line" style="width: 60%"></div>
                    <div class="skeleton-code-line" style="width: 30%"></div>
                  </div>
                </template>
                <pre v-else-if="store.computedJson" class="code-block"><code>{{ formattedJson }}</code></pre>
                <div v-else class="empty-json">
                  No computed VEDA JSON available.
                </div>
              </div>
            </div>

          </div>
        </transition>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

// Title SEO meta tags
useHead({
  title: 'SKK Migas - Veda CAPEX Forecasting Compare Results',
  meta: [
    { name: 'description', content: 'Advanced financial Capex comparing results dashboard powered by Veda AI Engine.' }
  ]
})

const store = useVedaStore()
const copied = ref(false)
const devToolsOpen = ref(false)

const activeTab = ref('Location')

const locationsData = [
  { name: 'Natuna Sea', lat: 4.0, lng: 108.0, labelAlign: 'left', coords: '4.0° N, 108.0° E' },
  { name: 'East Kalimantan', lat: -1.0, lng: 117.5, labelAlign: 'right', coords: '1.0° S, 117.5° E' },
  { name: 'Madura Strait', lat: -7.5, lng: 113.5, labelAlign: 'left', coords: '7.5° S, 113.5° E' },
  { name: 'Malacca Strait', lat: 3.5, lng: 99.0, labelAlign: 'right', coords: '3.5° N, 99.0° E' },
  { name: 'Sunda Asri', lat: -5.8, lng: 106.5, labelAlign: 'left', coords: '5.8° S, 106.5° E' },
  { name: 'Makassar Strait', lat: -1.5, lng: 118.8, labelAlign: 'right', coords: '1.5° S, 118.8° E' }
]

const getActiveCoords = computed(() => {
  const active = locationsData.find(l => l.name === store.selectedLocation)
  return active ? active.coords : '0.0° N, 0.0° E'
})

const dominantDriver = computed(() => {
  return store.componentFindings.find(c => c.isDominantDriver)
})

const dominantDriverRatio = computed(() => {
  return dominantDriver.value ? dominantDriver.value.contributionRatio : 0
})

const dominantDriverName = computed(() => {
  if (!dominantDriver.value) return 'None'
  return dominantDriver.value.costType.replace(/ (Costs|Cost)/g, '')
})

const historicalStatusLabel = computed(() => {
  if (store.computedJson?.overallSeverity === 'HIGH') return 'Unprecedented'
  if (store.computedJson?.overallSeverity === 'MEDIUM') return 'Outlier'
  return 'Normal'
})

// Variance Card Severity Class
const getSeverityBadgeClass = (deviation: number) => {
  if (deviation <= 5) return 'badge-low'
  if (deviation <= 15) return 'badge-medium'
  if (deviation <= 30) return 'badge-high'
  return 'badge-critical'
}


// Compute formatted JSON string for display
const formattedJson = computed(() => {
  if (!store.computedJson) return ''
  return JSON.stringify(store.computedJson, null, 2)
})

// Format Ari insights with bold markers
const formattedInsights = computed(() => {
  if (!store.insights) return ''
  // Wrap **text** in <strong> tags
  return store.insights
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
})

// Currency helper format
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val)
}

// Special mockup format rule to match user screenshot's comma position exactly
const formatCostBasisTotal = (val: number) => {
  if (val === 56723100) return '56,7231,00'
  return formatCurrency(val)
}

// Severity badge helpers based on deviation %
const getSeverityLabel = (deviation: number) => {
  if (deviation <= 5) return 'Low'
  if (deviation <= 15) return 'Medium'
  if (deviation <= 30) return 'High'
  return 'Critical'
}

const getSeverityClass = (deviation: number) => {
  if (deviation <= 5) return 'severity-low'
  if (deviation <= 15) return 'severity-medium'
  if (deviation <= 30) return 'severity-high'
  return 'severity-critical'
}

// Copy JSON utility
const copyJson = async () => {
  try {
    await navigator.clipboard.writeText(formattedJson.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy VEDA JSON:', err)
  }
}

// Map variables
let map: any = null
let markers: { [key: string]: any } = {}
let activeIcon: any = null
let inactiveIcon: any = null

const initMap = () => {
  const L = (window as any).L
  if (!L || map) return

  map = L.map('map-viewport', {
    center: [-2.0, 118.0],
    zoom: 5,
    zoomControl: false,
    attributionControl: false
  })

  // Add Zoom control to top-right
  L.control.zoom({ position: 'topright' }).addTo(map)

  // Add CartoDB Positron tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 7,
    minZoom: 4
  }).addTo(map)

  // Define marker icons
  activeIcon = L.divIcon({
    className: 'custom-leaflet-marker active-marker',
    html: `<div class="marker-dot"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  })

  inactiveIcon = L.divIcon({
    className: 'custom-leaflet-marker inactive-marker',
    html: `<div class="marker-dot"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5]
  })

  // Add markers
  locationsData.forEach(loc => {
    const isSelected = store.selectedLocation === loc.name
    const marker = L.marker([loc.lat, loc.lng], {
      icon: isSelected ? activeIcon : inactiveIcon,
      title: loc.name
    }).addTo(map)

    // Bind tooltip for the label
    marker.bindTooltip(loc.name, {
      permanent: true,
      direction: loc.labelAlign === 'left' ? 'left' : 'right',
      className: `map-label-tooltip ${isSelected ? 'active-tooltip' : 'inactive-tooltip'}`,
      offset: loc.labelAlign === 'left' ? [-10, 0] : [10, 0]
    })

    // Click handler
    marker.on('click', () => {
      store.selectedLocation = loc.name
    })

    markers[loc.name] = marker
  })
}

// Watch selectedLocation and update leaflet markers
watch(() => store.selectedLocation, (newLoc) => {
  if (!map) return
  const L = (window as any).L
  if (!L) return

  locationsData.forEach(loc => {
    const marker = markers[loc.name]
    if (marker) {
      const isSelected = newLoc === loc.name
      marker.setIcon(isSelected ? activeIcon : inactiveIcon)
      
      const tooltip = marker.getTooltip()
      if (tooltip) {
        const element = tooltip.getElement()
        if (element) {
          if (isSelected) {
            element.classList.add('active-tooltip')
            element.classList.remove('inactive-tooltip')
          } else {
            element.classList.remove('active-tooltip')
            element.classList.add('inactive-tooltip')
          }
        }
      }
    }
  })
})

// Trigger invalidateSize when activeTab changes to Location
watch(activeTab, (newTab) => {
  if (newTab === 'Location' && map) {
    setTimeout(() => {
      map.invalidateSize()
    }, 150)
  }
})

// Fetch scenarios on mount, which will trigger auto-selecting the first scenario
onMounted(async () => {
  await store.fetchScenarios()

  if (process.client) {
    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Inject Leaflet JS
    if (!(window as any).L) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => {
        initMap()
      }
      document.body.appendChild(script)
    } else {
      initMap()
    }
  }
})
</script>

<style scoped>
/* =============================================
   GLOBAL WRAPPER & CONTAINER
   ============================================= */
.dashboard-wrapper {
  min-height: 100vh;
  padding: 32px 40px 80px;
  background-color: #f4f4f0;
}

.container {
  max-width: 1360px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

/* =============================================
   AT A GLANCE SCORECARD ROW
   ============================================= */
.at-a-glance-section {
  margin-bottom: 24px;
}

.section-title {
  font-family: var(--font-family);
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 16px;
  letter-spacing: -0.3px;
}

.scorecard-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
}

.scorecard-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 100px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: transform 0.2s, box-shadow 0.2s;
}

.scorecard-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.neutral-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
}

.pink-card {
  background-color: #fdf0f0;
  border: 1px solid #fecaca;
}

.variance-card {
  background-color: #f6fbee;
  border: 1.5px solid #a3c96c;
}

/* Variance card — flat, no animation */

.card-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 6px;
  text-transform: capitalize;
}

.card-val {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.1;
  letter-spacing: -0.5px;
  margin-bottom: 4px;
}

.card-subtitle {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-top: 4px;
}

.subtext-bold {
  font-weight: 700;
  color: #334155;
}

.subtext-unit {
  font-weight: 400;
}

.card-val-skeleton {
  width: 80%;
  height: 28px;
  margin-bottom: 4px;
}

/* Severity Pill inside Variance Card */
.severity-badge-container {
  margin-top:0;
}

.severity-pill {
  font-family: var(--font-family);
  font-size: 10px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 99px;
  display: inline-block;
  text-transform: capitalize;
}

.badge-low {
  background-color: #dcfce7;
  color: #15803d;
}

.badge-medium {
  background-color: #fef3c7;
  color: #b45309;
}

.badge-high {
  background-color: #fee2e2;
  color: #b91c1c;
}

.badge-critical {
  background-color: #7f1d1d;
  color: #ffffff;
}

/* =============================================
   VISUALIZATION PANEL
   ============================================= */
.visualization-panel {
  margin-bottom: 36px;
  width: 100%;
}

.panel-header {
  margin-bottom: 12px;
}

.panel-title {
  font-family: var(--font-family);
  font-size: 16px;
  font-weight: 600;
  color: #475569;
}

.panel-content-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tab-panel-content {
  width: 100%;
}

.map-container {
  position: relative;
  width: 100%;
  height: 400px;
  border-radius: var(--border-radius-md);
  overflow: hidden;
  border: 1px solid #cbd5e1;
}

.leaflet-map-viewport {
  width: 100%;
  height: 100%;
}

/* Map coordinates info overlay card */
.map-info-overlay {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 500;
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid #cbd5e1;
  border-radius: var(--border-radius-sm);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  pointer-events: none;
  backdrop-filter: blur(4px);
  min-width: 180px;
}

.overlay-tag {
  font-size: 9px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.overlay-location-name {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.overlay-coords {
  font-family: var(--font-number);
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

/* Tabs layout */
.tab-bar-row {
  display: flex;
  justify-content: flex-start;
  border-top: 1px solid #f1f5f9;
  padding-top: 14px;
}

.tab-buttons {
  display: flex;
  gap: 8px;
}

.tab-btn {
  background: #f1f5f9;
  border: none;
  border-radius: 99px;
  padding: 8px 18px;
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  background: #e2e8f0;
  color: #334155;
}

.tab-btn.active-tab {
  background: linear-gradient(135deg, #fb923c, #ef4444);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
}

/* Placeholders */
.placeholder-tab {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: var(--border-radius-md);
}

.coming-soon-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #94a3b8;
}

.coming-soon-icon {
  width: 48px;
  height: 48px;
  opacity: 0.7;
}

.coming-soon-text {
  font-size: 14px;
  font-weight: 500;
}

/* =============================================
   FONT UTILITIES
   ============================================= */
.num-font {
  font-family: var(--font-number);
}

/* =============================================
   CONTROL PANEL
   ============================================= */
.control-panel {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-lg);
  padding: 20px 24px;
  margin-bottom: 36px;
  box-shadow: var(--shadow-sm);
}

.selector-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selector-label {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  letter-spacing: -0.2px;
}

.select-controls-wrapper {
  display: flex;
  align-items: center;
  gap: 16px;
}

.custom-select-wrapper {
  position: relative;
  width: 240px;
}

.scenario-select {
  width: 100%;
  appearance: none;
  background-color: #f8fafc;
  border: 1.5px solid #cbd5e1;
  border-radius: var(--border-radius-sm);
  padding: 10px 40px 10px 16px;
  font-family: var(--font-family);
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.scenario-select:focus {
  border-color: #10b981;
  background-color: #ffffff;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
}

.select-arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  pointer-events: none;
  display: flex;
  align-items: center;
}

.mini-loader {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(16, 185, 129, 0.2);
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}

.error-msg {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-danger);
  font-size: 13px;
  font-weight: 500;
  margin-top: 4px;
}

.error-icon {
  width: 16px;
  height: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* =============================================
   SKELETON HELPERS
   ============================================= */
.header-skeleton {
  width: 200px;
  height: 48px;
  border-radius: var(--border-radius-sm);
  margin: 4px 0;
}

.card-value-skeleton {
  width: 100px;
  height: 24px;
  border-radius: var(--border-radius-sm);
}

/* =============================================
   COMPARE RESULTS SECTION
   ============================================= */
.compare-results-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-label-row {
  display: flex;
  align-items: flex-end;
}

.section-label-block {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.compare-label {
  font-size: 30px;
  font-weight: 400;
  color: #0f172a;
  letter-spacing: -0.5px;
}

.results-label {
  font-size: 54px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
  letter-spacing: -2px;
  margin: 0;
}

/* =============================================
   3-COLUMN RESULTS GRID
   ============================================= */
.results-grid {
  display: flex;
  flex-direction: row;
 gap: 24px;
  align-items: start;
}

/* =============================================
   SHARED COLUMN HEADER BLOCK
   ============================================= */
.col-header-block {
  display: flex;
  flex-direction: column;
  margin-bottom: 18px;
}

.col-header-label {
  font-size: 22px;
  font-weight: 400;
  color: #475569;
  margin-bottom: 2px;
}

.col-header-value {
  font-size: 32px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1;
  letter-spacing: -1.5px;
}

.forecast-value-color {
  color: #0f172a;
}

.col-header-subtext {
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  margin-top: 6px;
}

.col-header-subtext.is-red {
  color: #f43f5e;
}

.subtext-bold {
  font-weight: 700;
  color: inherit;
}

.subtext-unit {
  font-weight: 400;
  opacity: 0.85;
}

/* =============================================
   COL 1: COST BASIS
   ============================================= */
.col-basis {
  margin-top:16px;
  display: flex;
  flex-direction: column;
    width: fit-content;

}

/* =============================================
   COL 2: FORECASTED (pink bg container)
   ============================================= */
.col-forecast {
  display: flex;
  flex-direction: column;
    width: fit-content;

}

.forecast-inner {
  background-color: #fdf0f0;
  border-radius: var(--border-radius-xl);
  padding: 16px;
  display: flex;
  flex-direction: column;
  width:280px;
}

/* =============================================
   COL 3: VARIANCE (green dashed border)
   ============================================= */
.col-variance {
  display: flex;
  flex-direction: column;
  width: fit-content;
}

.variance-inner {
  background-color: #f6fbee;
  border: 2px dashed #a3c96c;
  border-radius: var(--border-radius-xl);
  padding: 16px;
  display: flex;
  flex-direction: column;
  width:280px;
}

.variance-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.variance-label-text {
  color: #3a5c20;
}

/* Severity Badge */
.severity-badge {
  font-size: 11px;
  font-weight: 800;
  padding: 3px 10px;
  border-radius: 99px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.severity-low {
  background-color: #84cc16;
  color: #ffffff;
}

.severity-medium {
  background-color: #f59e0b;
  color: #ffffff;
}

.severity-high {
  background-color: #ef4444;
  color: #ffffff;
}

.severity-critical {
  background-color: #7f1d1d;
  color: #ffffff;
}

.variance-value-color {
  color: #3a5c20;
}

/* Variance sub-column header row */
.variance-subheader-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-bottom: 10px;
  margin-top: 12px;
}

.variance-subcol-label {
  font-size: 11px;
  font-weight: 600;
  color: #6b8f4a;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

/* =============================================
   CARDS LIST (shared)
   ============================================= */
.cards-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* =============================================
   BASIS CARDS
   ============================================= */
.basis-card {
  background-color: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: var(--border-radius-md);
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.basis-card.dominant-card {
  border-color: #fca5a5;
}

.card-left {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-prefix {
  font-size: 9px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 3px;
}

.dominant-prefix {
  color: #ef4444;
}

.card-name {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
}

.card-divider {
  width: 2px;
  height: 36px;
  background-color: #84cc16;
  margin: 0 18px;
  border-radius: 99px;
  flex-shrink: 0;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 100px;
}

.card-currency {
  font-size: 10px;
  font-weight: 500;
  color: #94a3b8;
  margin-bottom: 2px;
}

.card-value {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.5px;
}

/* =============================================
   FORECAST CARDS
   ============================================= */
.forecast-card {
  background-color: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: var(--border-radius-md);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 76px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  transition: border-color 0.2s;
}

.forecast-card.dominant-forecast-card {
  border-color: #fca5a5;
  border-style: dashed;
}

.card-badge-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.dominant-tag {
  font-size: 8px;
  font-weight: 700;
  color: #ef4444;
  background-color: #fee2e2;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

/* =============================================
   VARIANCE CARDS
   ============================================= */
.variance-card-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  min-height: 76px;
}

.variance-cell {
  background-color: #ffffff;
  border: 1px solid #d4e8b0;
  border-radius: var(--border-radius-md);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.variance-cell-amount {
  flex: 1;
}

.variance-cell-pct {
  min-width: 68px;
  align-items: center;
  text-align: center;
}

.pct-value {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.5px;
}

.var-positive {
  color: #c2410c; /* orange-red for positive variance (cost overrun) */
}

.var-negative {
  color: #15803d; /* green for negative variance (cost savings) */
}

/* =============================================
   WHAT ARI THINKS
   ============================================= */
.ari-section {
  margin-top: 48px;
}

.ari-card {
  position: relative;
  background-color: #ffffff;
  border: 1.5px solid #fecaca;
  border-radius: 16px;
  padding: 28px 32px 28px;
  margin-top: 28px;
}

.ari-header-tab {
  position: absolute;
  top: -1.5px;
  left: 20px;
  transform: translateY(-100%);
  background-color: #ffffff;
  border: 1.5px solid #fecaca;
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  padding: 4px 16px;
  height: 36px;
  display: flex;
  align-items: center;
  z-index: 10;
}

.ari-header-tab::after {
  content: '';
  position: absolute;
  bottom: -2.5px;
  left: 0.5px;
  right: 0.5px;
  height: 4px;
  background-color: #ffffff;
  z-index: 12;
}

.tab-text {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  white-space: nowrap;
}

.ari-highlight {
  color: #f43f5e;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sparkle {
  color: #f97316;
  font-size: 16px;
}

.ari-content {
  min-height: 80px;
}

.insights-text {
  font-size: 16px;
  color: #334155;
  line-height: 1.75;
  font-weight: 450;
  letter-spacing: -0.1px;
}

.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ari-error-state {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-danger);
  font-weight: 600;
  font-size: 14px;
}

.ari-error-icon {
  width: 20px;
  height: 20px;
}

.ari-empty-state {
  color: var(--color-text-muted);
  font-size: 14px;
  text-align: center;
  padding: 16px 0;
}

/* =============================================
   DEV TOOLS SECTION
   ============================================= */
.dev-tools-section {
  margin-top: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
}

.dev-tools-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: #f1f5f9;
  border: 1.5px solid #cbd5e1;
  border-radius: 99px;
  padding: 10px 22px;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  user-select: none;
}

.dev-tools-toggle:hover {
  background-color: #e2e8f0;
  border-color: #94a3b8;
  color: #334155;
}

.devtools-toggle-icon {
  width: 16px;
  height: 16px;
}

.dev-tools-badge {
  background-color: #334155;
  color: #f8fafc;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.dev-tools-content {
  width: 100%;
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* =============================================
   SUMMARY TABLE CARD
   ============================================= */
.summary-table-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-xl);
  padding: 28px 32px;
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.5px;
}

.table-subtitle {
  font-size: 14px;
  color: #64748b;
}

.scenario-badge {
  background-color: #e2e8f0;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  padding: 6px 12px;
  border-radius: 99px;
  font-family: var(--font-number);
}

.table-wrapper {
  overflow-x: auto;
}

.cost-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}

.cost-table th {
  padding: 12px 16px;
  font-weight: 600;
  color: #64748b;
  border-bottom: 2px solid #f1f5f9;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.cost-table td {
  padding: 16px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  vertical-align: middle;
}

.category-name {
  font-weight: 600;
  color: #0f172a;
}

.category-label-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dominant-table-tag {
  font-size: 8px;
  font-weight: 700;
  color: #ef4444;
  background-color: #fee2e2;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.5px;
}

.dominant-table-row {
  background-color: #fffafb;
}

.text-right {
  text-align: right;
}

.text-left {
  text-align: left;
}

.font-semibold {
  font-weight: 600;
}

.font-bold {
  font-weight: 700;
  color: #0f172a;
}

.text-red {
  color: #e11d48;
}

.text-green {
  color: #16a34a;
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
}

.badge-red {
  background-color: #fee2e2;
  color: #991b1b;
}

.badge-red-bold {
  background-color: #ef4444;
  color: #ffffff;
}

.badge-green {
  background-color: #dcfce7;
  color: #166534;
}

.badge-gray {
  background-color: #f1f5f9;
  color: #475569;
}

/* Total row styling */
.total-row-item {
  background-color: #f8fafc;
}

.total-row-item td {
  border-top: 2px solid #e2e8f0;
  border-bottom: 2px solid #e2e8f0;
  color: #0f172a;
}

/* Skeleton rows */
.skeleton-row td {
  padding: 20px 16px;
}

/* =============================================
   VEDA JSON CARD
   ============================================= */
.json-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: var(--border-radius-xl);
  padding: 28px 32px;
  box-shadow: var(--shadow-sm);
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: var(--border-radius-sm);
  padding: 8px 16px;
  font-family: var(--font-family);
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.copy-btn:hover:not(:disabled) {
  border-color: #10b981;
  color: #10b981;
  background-color: #f0fdf4;
}

.copy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.code-container {
  position: relative;
  background-color: #0f172a;
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.code-block {
  margin: 0;
  padding: 20px;
  overflow: auto;
  max-height: 480px;
}

.code-block code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #e2e8f0;
}

.empty-json {
  padding: 32px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}

.skeleton-code-wrapper {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-code-line {
  height: 14px;
  background-color: #1e293b;
  border-radius: 4px;
}

/* =============================================
   TRANSITIONS
   ============================================= */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}
.slide-fade-leave-active {
  transition: all 0.25s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* =============================================
   RESPONSIVE
   ============================================= */
@media (max-width: 1100px) {
  .results-grid {
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .col-variance {
    grid-column: 1 / span 2;
  }
}

@media (max-width: 768px) {
  .dashboard-wrapper {
    padding: 40px 20px 60px;
  }
  .results-grid {
    grid-template-columns: 1fr;
  }
  .col-variance {
    grid-column: 1;
  }
  .results-label {
    font-size: 40px;
  }
}
</style>

<!-- Global (non-scoped) styles: Leaflet injects DOM outside Vue's shadow,
     so scoped CSS cannot reach the marker and tooltip elements. -->
<style>
/* =============================================
   LEAFLET CUSTOM MARKERS
   ============================================= */

/* Strip Leaflet's default marker background */
.custom-leaflet-marker {
  background: transparent !important;
  border: none !important;
}

/* Inactive marker dot — slate */
.inactive-marker .marker-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: #64748b;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition: background-color 0.25s ease;
}

/* Active marker dot — coral/red brand color */
.active-marker .marker-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: #ef4444;
  border: 2.5px solid #ffffff;
  box-shadow: 0 1px 6px rgba(239, 68, 68, 0.45);
  cursor: pointer;
  transition: background-color 0.25s ease;
}

/* =============================================
   LEAFLET TOOLTIP LABELS (permanent, no arrow)
   ============================================= */
.map-label-tooltip {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  font-family: 'Poppins', 'Inter', sans-serif !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  white-space: nowrap;
  padding: 0 !important;
}

/* Remove the Leaflet tooltip triangle arrow */
.map-label-tooltip::before {
  display: none !important;
}

.inactive-tooltip {
  color: #64748b !important;
}

.active-tooltip {
  color: #0f172a !important;
  font-weight: 700 !important;
  font-size: 12px !important;
}
</style>
