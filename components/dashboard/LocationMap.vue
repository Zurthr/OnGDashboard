<template>
  <div class="visualization-panel">
    <div class="panel-header">
      <span class="panel-title">Visualization: Operation Location</span>
    </div>

    <div class="panel-content-card">
      <!-- ── Tab content: v-if mounts/unmounts each child fresh ── -->
      <div class="tab-panel-content">
        <LocationTab  v-if="activeTab === 'Location'"  />
        <VarianceTab  v-if="activeTab === 'Variance'"  />
        <TreemapTab   v-if="activeTab === 'Treemap'"   />
      </div>

      <!-- ── Tab bar ── -->
      <div class="tab-bar-row">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LocationTab from '~/components/dashboard/tabs/LocationTab.vue'
import VarianceTab from '~/components/dashboard/tabs/VarianceTab.vue'
import TreemapTab  from '~/components/dashboard/tabs/TreemapTab.vue'

const tabs = ['Location', 'Variance', 'Treemap'] as const
const activeTab = ref<typeof tabs[number]>('Location')
</script>

<style scoped>
/* =============================================
   VISUALIZATION PANEL
   ============================================= */
.visualization-panel {
  margin-bottom: 36px;
  width: 1024px;
  max-width: 1024px;
  flex-shrink: 0;
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

/* ── Tab bar ── */
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
</style>
