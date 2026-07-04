<template>
  <div style="display:flex; width:100vw; max-width:2040px; justify-content:center; flex-direction: row; justify-self:center;">
  <Sidebar />

  <div style="display: grid; flex-direction: row; justify-content: center; max-width:1360px; width: 1140px;">
    <NuxtPage />
  </div>
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
