<template>
  <div>
    <StickyNav />
    <div class="page-offset">
      <NuxtPage />
    </div>
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
