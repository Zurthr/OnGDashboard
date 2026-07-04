<template>
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

      <!-- Variance Tab Content -->
      <div v-show="activeTab === 'Variance'" class="tab-panel-content">
        <div class="charts-row">
          <!-- Card 1: Forecast Variance -->
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-titles">
                <div class="title-with-icon">
                  <Icon name="heroicons:chart-bar-20-solid" class="card-title-icon" />
                  <h3 class="card-chart-title">Forecast Variance</h3>
                </div>
                <span class="card-chart-subtitle">Visualization of the Forecast with Deviations marked. Hover for details.</span>
              </div>
              <div class="card-header-right">
                <Icon 
                  :name="store.summaryFindings.percentageDeviationTotal >= 0 ? 'heroicons:arrow-trending-up-20-solid' : 'heroicons:arrow-trending-down-20-solid'" 
                  :class="store.summaryFindings.percentageDeviationTotal >= 0 ? 'trend-up-icon' : 'trend-down-icon'" 
                />
                <span class="trend-value" :class="store.summaryFindings.percentageDeviationTotal >= 0 ? 'trend-up-text' : 'trend-down-text'">
                  {{ store.summaryFindings.percentageDeviationTotal >= 0 ? '+' : '' }}{{ store.summaryFindings.percentageDeviationTotal }}%
                </span>
              </div>
            </div>
            
            <div class="chart-wrapper">
              <component :is="VChart" v-if="VChart" :option="chartOption1" class="echart-instance" />
              <div v-else class="chart-loading">Loading chart...</div>
            </div>
          </div>

          <!-- Card 2: Waterfall: Deviations -->
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-titles">
                <div class="title-with-icon">
                  <Icon name="heroicons:presentation-chart-bar-20-solid" class="card-title-icon" />
                  <h3 class="card-chart-title">Waterfall: Deviations</h3>
                </div>
                <span class="card-chart-subtitle">Waterfall Chart on the Variations. Hover for details.</span>
              </div>
            </div>

            <div class="chart-wrapper">
              <component :is="VChart" v-if="VChart" :option="chartOption2" class="echart-instance" />
              <div v-else class="chart-loading">Loading chart...</div>
            </div>

            <!-- Waterfall Legend -->
            <div class="waterfall-legend">
              <div class="legend-item"><span class="color-box base-box"></span><span>Base</span></div>
              <div class="legend-item"><span class="color-box increase-box"></span><span>Increase</span></div>
              <div class="legend-item"><span class="color-box decrease-box"></span><span>Decrease</span></div>
              <div class="legend-item"><span class="color-box forecast-box"></span><span>Forecast</span></div>
            </div>
          </div>

          <!-- Card 3: Pie Chart on Deviations -->
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-titles">
                <div class="title-with-icon">
                  <Icon name="heroicons:chart-pie-20-solid" class="card-title-icon" />
                  <h3 class="card-chart-title">Pie Chart on Deviations</h3>
                </div>
                <span class="card-chart-subtitle">Proportional contribution of each cost category to the total forecasted cost.</span>
              </div>
            </div>

            <div class="chart-wrapper">
              <component :is="VChart" v-if="VChart" :option="chartOption3" class="echart-instance" />
              <div v-else class="chart-loading">Loading chart...</div>
            </div>

            <!-- Pie Legend -->
            <div class="pie-legend">
              <div v-for="item in pieLegendItems" :key="item.label" class="legend-item">
                <span class="color-box" :style="{ backgroundColor: item.color }"></span>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Treemap Tab Content (Placeholder) -->
      <div v-show="activeTab === 'Treemap'" class="tab-panel-content placeholder-tab">
        <div class="coming-soon-wrapper">
          <Icon name="heroicons:square-2-stack-20-solid" class="coming-soon-icon" />
          <span class="coming-soon-text">Treemap visualization coming soon</span>
        </div>
      </div>
      
      <!-- Tab Bar -->
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
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, shallowRef } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

const store = useVedaStore()
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

// Local currency format helper
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val)
}

// Map cost categories to abbreviated labels
const getAbbreviation = (costType: string) => {
  const type = costType.toLowerCase()
  if (type.includes('pipeline')) return 'PL'
  if (type.includes('facility') || type.includes('facilities') || type.includes('production')) return 'PF'
  if (type.includes('deck') || (type.includes('structure') && !type.includes('sub'))) return 'DS'
  if (type.includes('substructure') || type.includes('sub-structure')) return 'SUB'
  if (type.includes('certif') || type.includes('permit')) return 'C&F'
  if (type.includes('support') || type.includes('general')) return 'GS'
  return 'OTHER'
}

// Assemble category breakdown records
const getCategoryData = () => {
  const result = {
    PL: { baseline: 0, forecast: 0, variance: 0 },
    PF: { baseline: 0, forecast: 0, variance: 0 },
    DS: { baseline: 0, forecast: 0, variance: 0 },
    SUB: { baseline: 0, forecast: 0, variance: 0 },
    'C&F': { baseline: 0, forecast: 0, variance: 0 },
    GS: { baseline: 0, forecast: 0, variance: 0 }
  }
  
  store.componentFindings.forEach(f => {
    const abb = getAbbreviation(f.costType)
    if (abb in result) {
      result[abb as keyof typeof result] = {
        baseline: f.baseline,
        forecast: f.forecast,
        variance: f.absoluteVariance
      }
    }
  })
  return result
}

// ShallowRef prevents Nuxt SSR compiling issues for client-only components
const VChart = shallowRef<any>(null)

// ── Chart 1: Forecast Variance (Stacked Bar) ──
const chartOption1 = computed(() => {
  const data = getCategoryData()
  const categories = ['PL', 'PF', 'DS', 'SUB', 'C&F', 'GS']
  const baselineData = categories.map(cat => data[cat as keyof typeof data].baseline)
  const deviationData = categories.map(cat => data[cat as keyof typeof data].variance)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const cat = params[0].name
        const base = params[0].value
        const dev = params[1].value
        const total = base + dev
        return `
          <div style="font-family: var(--font-family); font-size: 11px; padding: 4px; line-height: 1.5;">
            <strong style="color: #0f172a; font-size: 12px; margin-bottom: 4px; display: inline-block;">Category: ${cat}</strong><br/>
            <span style="color: #64748b;">Baseline:</span> $${formatCurrency(base)}<br/>
            <span style="color: #64748b;">Deviation:</span> $${formatCurrency(dev)}<br/>
            <strong style="color: #D85A30;">Forecast:</strong> $${formatCurrency(total)}
          </div>
        `
      }
    },
    legend: {
      show: false
    },
    grid: { top: '10%', left: '3%', right: '3%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontWeight: 600, fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
      axisLabel: {
        color: '#64748b',
        fontWeight: 600,
        fontSize: 10,
        formatter: (value: number) => {
          if (value >= 1000000) return (value / 1000000).toFixed(0) + 'M'
          if (value >= 1000) return (value / 1000).toFixed(0) + 'K'
          return value
        }
      }
    },
    series: [
      {
        name: 'Baseline',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#D85A30' },
        barWidth: '55%',
        data: baselineData
      },
      {
        name: 'Deviation',
        type: 'bar',
        stack: 'total',
        itemStyle: { color: '#a3c96c' },
        barWidth: '55%',
        data: deviationData
      }
    ]
  }
})

// ── Chart 2: Waterfall: Deviations (Floating stack chart) ──
const getWaterfallData = () => {
  const data = getCategoryData()
  const categories = ['PL', 'PF', 'DS', 'SUB', 'C&F', 'GS']
  
  const names = ['Base', ...categories, 'Forecast']
  const baseVal = store.summaryFindings.baselineTotal
  const forecastVal = store.summaryFindings.forecastTotal
  
  const minY = Math.floor(Math.min(baseVal, forecastVal) / 1000000 - 1) * 1000000
  
  const placeholder: number[] = []
  const visibleData: any[] = []
  
  // Base
  placeholder.push(minY)
  visibleData.push({
    value: baseVal - minY,
    itemStyle: { color: '#fb923c' }
  })
  
  let runningTotal = baseVal
  categories.forEach(cat => {
    const dev = data[cat as keyof typeof data].variance
    const prevTotal = runningTotal
    runningTotal += dev
    
    if (dev >= 0) {
      placeholder.push(prevTotal)
      visibleData.push({
        value: dev,
        itemStyle: { color: '#ef4444' }
      })
    } else {
      placeholder.push(runningTotal)
      visibleData.push({
        value: Math.abs(dev),
        itemStyle: { color: '#a3c96c' }
      })
    }
  })
  
  // Forecast
  placeholder.push(minY)
  visibleData.push({
    value: forecastVal - minY,
    itemStyle: { color: '#fca5a5' }
  })
  
  return { names, placeholder, visibleData, minY }
}

const chartOption2 = computed(() => {
  const wf = getWaterfallData()
  
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const name = params[0].name
        const base = wf.placeholder[params[0].dataIndex]
        const heightVal = params[1].value
        
        if (name === 'Base') {
          return `<strong style="color: #fb923c;">Base:</strong> $${formatCurrency(base + heightVal)}`
        } else if (name === 'Forecast') {
          return `<strong style="color: #fca5a5;">Forecast:</strong> $${formatCurrency(base + heightVal)}`
        } else {
          const data = getCategoryData()
          const dev = data[name as keyof typeof data]?.variance || 0
          const sign = dev >= 0 ? '+' : ''
          const color = dev >= 0 ? '#ef4444' : '#a3c96c'
          return `
            <div style="font-family: var(--font-family); font-size: 11px; padding: 4px; line-height: 1.5;">
              <strong style="color: #0f172a; font-size: 12px; margin-bottom: 4px; display: inline-block;">Category: ${name}</strong><br/>
              <span style="color: #64748b;">Deviation:</span> <span style="color: ${color}; font-weight: 700;">${sign}$${formatCurrency(dev)}</span>
            </div>
          `
        }
      }
    },
    grid: { top: '10%', left: '3%', right: '3%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: wf.names,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#64748b', fontWeight: 600, fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      min: wf.minY,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
      axisLabel: {
        color: '#64748b',
        fontWeight: 600,
        fontSize: 10,
        formatter: (value: number) => {
          if (value >= 1000000) return (value / 1000000).toFixed(0) + 'M'
          return value
        }
      }
    },
    series: [
      {
        name: 'Placeholder',
        type: 'bar',
        stack: 'all',
        itemStyle: { borderColor: 'transparent', color: 'transparent' },
        emphasis: { itemStyle: { borderColor: 'transparent', color: 'transparent' } },
        data: wf.placeholder
      },
      {
        name: 'Value',
        type: 'bar',
        stack: 'all',
        data: wf.visibleData,
        barWidth: '60%',
        itemStyle: { borderRadius: 3 }
      }
    ]
  }
})

// ── Chart 3: Proportional Slice Contribution (Pie) ──
const chartOption3 = computed(() => {
  const data = getCategoryData()
  const pieData = [
    { name: 'Pipeline', value: data['PL'].forecast, itemStyle: { color: '#D85A30' } },
    { name: 'Production Facilities', value: data['PF'].forecast, itemStyle: { color: '#a3c96c' } },
    { name: 'Deck Structure', value: data['DS'].forecast, itemStyle: { color: '#3f6212' } },
    { name: 'Substructure', value: data['SUB'].forecast, itemStyle: { color: '#fca5a5' } },
    { name: 'Certifications and Permits', value: data['C&F'].forecast, itemStyle: { color: '#f97316' } },
    { name: 'General Support', value: data['GS'].forecast, itemStyle: { color: '#fb923c' } }
  ]
  
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `
          <div style="font-family: var(--font-family); font-size: 11px; padding: 4px; line-height: 1.5;">
            <strong style="color: #0f172a; font-size: 12px; margin-bottom: 4px; display: inline-block;">${params.name}</strong><br/>
            Forecast: $${formatCurrency(params.value)}<br/>
            Proportion: <strong>${params.percent}%</strong>
          </div>
        `
      }
    },
    series: [
      {
        type: 'pie',
        radius: '75%',
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: '#ffffff', borderWidth: 1.5 },
        data: pieData
      }
    ]
  }
})

const pieLegendItems = [
  { label: 'Substruct.', color: '#fca5a5' },
  { label: 'Pipeline', color: '#D85A30' },
  { label: 'Product.', color: '#a3c96c' },
  { label: 'C&F', color: '#f97316' },
  { label: 'Dec Str.', color: '#3f6212' },
  { label: 'General Sup.', color: '#fb923c' }
]

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

  L.control.zoom({ position: 'topright' }).addTo(map)

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 7,
    minZoom: 4
  }).addTo(map)

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

  locationsData.forEach(loc => {
    const isSelected = store.selectedLocation === loc.name
    const marker = L.marker([loc.lat, loc.lng], {
      icon: isSelected ? activeIcon : inactiveIcon,
      title: loc.name
    }).addTo(map)

    marker.bindTooltip(loc.name, {
      permanent: true,
      direction: loc.labelAlign === 'left' ? 'left' : 'right',
      className: `map-label-tooltip ${isSelected ? 'active-tooltip' : 'inactive-tooltip'}`,
      offset: loc.labelAlign === 'left' ? [-10, 0] : [10, 0]
    })

    marker.on('click', () => {
      store.selectedLocation = loc.name
    })

    markers[loc.name] = marker
  })
}

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
  if (newTab === 'Variance') {
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 150)
  }
})

onMounted(async () => {
  if (process.client) {
    // Dynamically load ECharts and vue-echarts wrapper
    try {
      const { default: vc } = await import('vue-echarts')
      // vue-echarts depends on registering echarts components
      const echarts = await import('echarts')
      VChart.value = vc
    } catch (err) {
      console.error('Failed to import ECharts:', err)
    }

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
   ECHARTS VARIANCE TAB STYLES
   ============================================= */
.charts-row {
  display: flex;
  flex-direction: row;
  gap: 16px;
  width: 100%;
  box-sizing: border-box;
}

.chart-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px 16px 16px 16px;
  flex: 1;
  min-width: 0; /* Ensures column flexing works without overflow */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.chart-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
  min-height: 56px;
}

.chart-card-titles {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  padding-right: 8px;
}

.title-with-icon {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title-icon {
  width: 18px;
  height: 18px;
  color: #475569;
  flex-shrink: 0;
}

.card-chart-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.2;
}

.card-chart-subtitle {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
  line-height: 1.4;
}

.card-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  background-color: #f1fdf4;
  border: 1px solid #dcfce7;
  border-radius: 99px;
  padding: 4px 10px;
  flex-shrink: 0;
}

.trend-up-icon, .trend-up-text {
  color: #16a34a;
}

.trend-down-icon, .trend-down-text {
  color: #ef4444;
}

.trend-value {
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-number);
}

.chart-wrapper {
  width: 100%;
  height: 220px;
  position: relative;
  margin: 8px 0;
}

.echart-instance {
  width: 100% !important;
  height: 100% !important;
}

.chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 500;
}

/* Custom legends */
.waterfall-legend {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.pie-legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  width: fit-content;
  margin: auto auto 0 auto;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #475569;
  font-weight: 600;
}

.color-box {
  width: 10px;
  height: 10px;
  border-radius: 2.5px;
  flex-shrink: 0;
}

.base-box {
  background-color: #fb923c;
}

.increase-box {
  background-color: #ef4444;
}

.decrease-box {
  background-color: #a3c96c;
}

.forecast-box {
  background-color: #fca5a5;
}

@media (max-width: 1024px) {
  .charts-row {
    flex-direction: column;
  }
}
</style>

<!-- Global style block for dynamic Leaflet overlay objects -->
<style>
.custom-leaflet-marker {
  background: transparent !important;
  border: none !important;
}

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
