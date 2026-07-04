<template>
  <div class="map-container">
    <div id="map-viewport" class="leaflet-map-viewport"></div>

    <div class="map-info-overlay">
      <span class="overlay-tag">OFFSHORE PROVINCE</span>
      <span class="overlay-location-name">{{ store.selectedLocation }}</span>
      <span class="overlay-coords">{{ activeCoords }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useVedaStore } from '~/stores/vedaStore'

const store = useVedaStore()

const locationsData = [
  { name: 'Natuna Sea',     lat:  4.0,  lng: 108.0, labelAlign: 'left',  coords: '4.0° N, 108.0° E' },
  { name: 'East Kalimantan', lat: -1.0, lng: 117.5, labelAlign: 'right', coords: '1.0° S, 117.5° E' },
  { name: 'Madura Strait',  lat: -7.5,  lng: 113.5, labelAlign: 'left',  coords: '7.5° S, 113.5° E' },
  { name: 'Malacca Strait', lat:  3.5,  lng:  99.0, labelAlign: 'right', coords: '3.5° N, 99.0° E'  },
  { name: 'Sunda Asri',     lat: -5.8,  lng: 106.5, labelAlign: 'left',  coords: '5.8° S, 106.5° E' },
  { name: 'Makassar Strait', lat: -1.5, lng: 118.8, labelAlign: 'right', coords: '1.5° S, 118.8° E' },
]

const activeCoords = computed(() => {
  const found = locationsData.find(l => l.name === store.selectedLocation)
  return found ? found.coords : '0.0° N, 0.0° E'
})

let map: any = null
let markers: Record<string, any> = {}
let activeIcon: any = null
let inactiveIcon: any = null

const initMap = () => {
  const L = (window as any).L
  if (!L || map) return

  map = L.map('map-viewport', {
    center: [-2.0, 118.0],
    zoom: 5,
    zoomControl: false,
    attributionControl: false,
  })

  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 7,
    minZoom: 4,
  }).addTo(map)

  activeIcon = L.divIcon({
    className: 'custom-leaflet-marker active-marker',
    html: `<div class="marker-dot"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  })

  inactiveIcon = L.divIcon({
    className: 'custom-leaflet-marker inactive-marker',
    html: `<div class="marker-dot"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  })

  locationsData.forEach(loc => {
    const isSelected = store.selectedLocation === loc.name
    const marker = L.marker([loc.lat, loc.lng], {
      icon: isSelected ? activeIcon : inactiveIcon,
      title: loc.name,
    }).addTo(map)

    marker.bindTooltip(loc.name, {
      permanent: true,
      direction: loc.labelAlign === 'left' ? 'left' : 'right',
      className: `map-label-tooltip ${isSelected ? 'active-tooltip' : 'inactive-tooltip'}`,
      offset: loc.labelAlign === 'left' ? [-10, 0] : [10, 0],
    })

    marker.on('click', () => { store.selectedLocation = loc.name })
    markers[loc.name] = marker
  })

  // Small delay to let the DOM paint before invalidating size
  setTimeout(() => map?.invalidateSize(), 100)
}

watch(() => store.selectedLocation, newLoc => {
  if (!map) return
  const L = (window as any).L
  if (!L) return

  locationsData.forEach(loc => {
    const marker = markers[loc.name]
    if (!marker) return
    const isSelected = newLoc === loc.name
    marker.setIcon(isSelected ? activeIcon : inactiveIcon)
    const el = marker.getTooltip()?.getElement()
    if (el) {
      el.classList.toggle('active-tooltip', isSelected)
      el.classList.toggle('inactive-tooltip', !isSelected)
    }
  })
})

onMounted(() => {
  if (!process.client) return

  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link')
    link.id = 'leaflet-css'
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
  }

  if (!(window as any).L) {
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = initMap
    document.body.appendChild(script)
  } else {
    initMap()
  }
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  markers = {}
})
</script>

<style scoped>
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
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
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
</style>

<!-- Leaflet injects DOM outside Vue scope — must be non-scoped -->
<style>
.custom-leaflet-marker { background: transparent !important; border: none !important; }

.inactive-marker .marker-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background-color: #64748b;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  cursor: pointer; transition: background-color 0.25s;
}

.active-marker .marker-dot {
  width: 14px; height: 14px; border-radius: 50%;
  background-color: #ef4444;
  border: 2.5px solid #ffffff;
  box-shadow: 0 1px 6px rgba(239,68,68,0.45);
  cursor: pointer; transition: background-color 0.25s;
}

.map-label-tooltip {
  background: transparent !important; border: none !important;
  box-shadow: none !important;
  font-family: 'Poppins','Inter',sans-serif !important;
  font-size: 11px !important; font-weight: 600 !important;
  white-space: nowrap; padding: 0 !important;
}
.map-label-tooltip::before { display: none !important; }
.inactive-tooltip { color: #64748b !important; }
.active-tooltip { color: #0f172a !important; font-weight: 700 !important; font-size: 12px !important; }
</style>
