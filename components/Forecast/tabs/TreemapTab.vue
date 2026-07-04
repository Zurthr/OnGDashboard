<template>
  <div class="placeholder-tab">
    <div class="coming-soon-wrapper">
      <Icon name="heroicons:square-2-stack-20-solid" class="coming-soon-icon" />
      <span class="coming-soon-title">Treemap Analysis</span>
      <span class="coming-soon-text">Treemap visualization coming soon</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// No logic needed yet — placeholder
</script>

<style scoped>
.placeholder-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  width: 100%;
}

.coming-soon-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
}

.coming-soon-icon { width: 40px; height: 40px; color: #cbd5e1; }
.coming-soon-title { font-size: 16px; font-weight: 700; color: #64748b; }
.coming-soon-text  { font-size: 13px; color: #94a3b8; }
</style>
