<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">Extract AFE Data</h1>
    </div>
    <ExtractUploadZone />
    <ExtractQueue />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useExtractStore } from '~/stores/extractStore'

useHead({ title: 'SKK Migas — Extract AFE Data' })

const store = useExtractStore()
onMounted(() => {
  store.restoreQueue()
  store.hydrateFromDatabase()
})
</script>

<style scoped>
.page {
  width: 1064px;
  max-width: 1064px;
  padding: 48px 32px 80px;
  box-sizing: border-box;
}
.page-head { margin-bottom: 24px; }
.page-title {
  font-family: 'Poppins', sans-serif;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.6px;
  color: #0f172a;
  margin: 0;
}

@media (max-width: 1000px) {
  .page { width: 100%; }
}
</style>
