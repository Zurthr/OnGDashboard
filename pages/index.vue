<script setup lang="ts">
definePageMeta({
  middleware: [
    () => navigateTo('/platform', { redirectCode: 302, replace: true })
  ]
})

await navigateTo('/platform', { redirectCode: 302, replace: true })
</script>

<template>
  <div />
</template>