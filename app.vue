<template>
  <Sidebar />

  <div style="display: flex; flex-direction: row; justify-content: center;">
    <StickyNav />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import Sidebar from '~/components/Sidebar.vue'
import StickyNav from '~/components/StickyNav.vue'
</script>

<style>
/* Push page content below the sticky bar height (~58px) */
.page-offset {
  padding-top: 58px;
}
</style>
