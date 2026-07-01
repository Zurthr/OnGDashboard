<template >
  <Sidebar />\

  <div style="justify-content:center; display:flex; flex-direction:row;">
          <StickyNav />
      <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import StickyNav from '~/components/StickyNav.vue'
</script>

<style>
/* Push page content below the sticky bar height (~58px) */
.page-offset {
  padding-top: 58px;
}
</style>
