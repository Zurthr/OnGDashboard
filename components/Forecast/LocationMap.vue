<template>
  <div class="visualization-panel">
    <div class="panel-header">
      <span class="panel-title">Visualization: Operation Location</span>
    </div>

    <div class="panel-content-card">
      <!-- ── Tab content with animated height container ── -->
      <div class="tab-panel-content animate-height" :style="{ minHeight: activeTabHeight }">
        <Transition name="tab-fade" mode="out-in">
          <LocationTab v-if="activeTab === 'Location'" />
          <VarianceTab v-else-if="activeTab === 'Variance'" />
          <TreemapTab  v-else-if="activeTab === 'Treemap'"  :mode="treemapMode" />
        </Transition>
      </div>

      <!-- ── Tab bar ── -->
      <div class="tab-bar-row">
        <!-- Tab buttons -->
        <div class="tab-buttons">
          <button
            v-for="tab in tabs"
            :key="tab"
            class="tab-btn"
            :class="{ 'active-tab': activeTab === tab }"
            @click="activeTab = tab"
          >
            {{ tab }}
          </button>
        </div>

        <!-- Treemap mode switcher — only visible when Treemap tab is active -->
        <Transition name="fade-slide">
          <div v-if="activeTab === 'Treemap'" class="treemap-mode-switcher">
            <span class="mode-label">View:</span>
            <button
              v-for="m in treemapModes"
              :key="m.value"
              class="mode-btn"
              :class="{ 'mode-btn--active': treemapMode === m.value }"
              @click="treemapMode = m.value"
            >
              {{ m.label }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import LocationTab from '~/components/Forecast/tabs/LocationTab.vue'
import VarianceTab from '~/components/Forecast/tabs/VarianceTab.vue'
import TreemapTab  from '~/components/Forecast/tabs/TreemapTab.vue'

const tabs = ['Location', 'Variance', 'Treemap'] as const
const activeTab = ref<typeof tabs[number]>('Location')

type TreemapMode = 'variance' | 'baseline' | 'forecast'
const treemapMode  = ref<TreemapMode>('variance')
const treemapModes: { label: string; value: TreemapMode }[] = [
  { label: 'Variance',  value: 'variance'  },
  { label: 'Baseline',  value: 'baseline'  },
  { label: 'Forecast',  value: 'forecast'  },
]

// Dynamic height matching each active tab layout to enable smooth parent container transitions
const activeTabHeight = computed(() => {
  if (activeTab.value === 'Location') return '402px'
  if (activeTab.value === 'Variance') return '340px'
  return '480px' // Treemap fixed height
})
</script>

<style scoped>
/* =============================================
   VISUALIZATION PANEL
   ============================================= */
.visualization-panel {
  margin-bottom: 36px;
  width: 1064px;
  max-width: 1064px;
  flex-shrink: 0;
}

.panel-header { margin-bottom: 12px; }
.panel-title  { font-size: 16px; font-weight: 600; color: #475569; }

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
  position: relative;
}

.animate-height {
  transition: min-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* ── Tab Switch transitions ── */
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

/* ── Tab bar ── */
.tab-bar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid #f1f5f9;
  padding-top: 12px;
  gap: 12px;
}

.tab-buttons { display: flex; gap: 8px; }

.tab-btn {
  background: #f1f5f9;
  border: none;
  border-radius: 99px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  color: #333333;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
}

.tab-btn:hover { background: #e2e8f0; color: #334155; }

.tab-btn.active-tab {
  background: var(--platform2);
  color: #261812;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
}

/* ── Treemap mode switcher ── */
.treemap-mode-switcher {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 99px;
  padding: 4px 8px 4px 10px;
}

.mode-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  flex-shrink: 0;
}

.mode-btn {
  background: transparent;
  border: none;
  border-radius: 99px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  outline: none;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.mode-btn:hover { background: #e2e8f0; color: #334155; }

.mode-btn--active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

/* ── Transition for switcher appearing ── */
.fade-slide-enter-active { transition: all 0.2s ease; }
.fade-slide-leave-active { transition: all 0.15s ease; }
.fade-slide-enter-from   { opacity: 0; transform: translateX(8px); }
.fade-slide-leave-to     { opacity: 0; transform: translateX(8px); }
</style>
