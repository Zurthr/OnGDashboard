<template>
  <div
    class="sticky-header-wrapper"
    :class="{ 'nav-hidden': isHidden, 'nav-visible': !isHidden }"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div class="sticky-header-inner">
      <div class="ph-actions"><slot /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

/* ── Scroll hide / show logic (duplicated per page, not shared) ── */
const isHidden = ref(false)
let lastScrollY = 0
let isMouseOver = false

const handleScroll = () => {
  const currentY = window.scrollY
  const delta = currentY - lastScrollY

  if (delta > 6 && currentY > 80) {
    if (!isMouseOver) isHidden.value = true
  } else if (delta < -4) {
    isHidden.value = false
  }
  lastScrollY = currentY
}

const handleMouseMove = (e: MouseEvent) => {
  if (e.clientY < 12) isHidden.value = false
}

const onMouseEnter = () => { isMouseOver = true; isHidden.value = false }
const onMouseLeave = () => { isMouseOver = false }

onMounted(() => {
  lastScrollY = window.scrollY
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('mousemove', handleMouseMove, { passive: true })
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<style scoped>
.sticky-header-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px) saturate(1.6);
  -webkit-backdrop-filter: blur(16px) saturate(1.6);
  border-bottom: 2px solid rgba(255, 153, 153, 0.4);
  box-shadow: 0 2px 24px rgba(0, 0, 0, 0.06);
  border-radius: 0 0 12px 12px;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
  will-change: transform;
}
.nav-visible { transform: translateY(0); opacity: 1; }
.nav-hidden { transform: translateY(-110%); opacity: 0; }

.sticky-header-inner {
  width: 100%;
  max-width: 1360px;
  height: 64px;
  max-height: 88px;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  box-sizing: border-box;
}

.ph-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
</style>
