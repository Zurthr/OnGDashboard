<template>
    <div class="sidebar-card">

      <!-- ── Logo ─────────────────────────────────── -->
      <div class="sidebar-logo">
        <img src="assets\icons\skk.png" alt="SKK Migas" class="logo-icon">
        <div class="logo-text">
          <span class="logo-org">SKK Migas</span>
          <span class="logo-product">Cost Estimation</span>
        </div>
      </div>

      <!-- ── PLATFORM ──────────────────────────────── -->
      <div class="nav-section">
        <span class="nav-section-label">Platform</span>

        <!-- Dashboard -->
        <NuxtLink to="/" class="nav-item" :class="{ 'nav-item--active': route.path === '/' }">
          <img src="assets\icons\db.png" alt="Dashboard" class="nav-icon">
          <span class="nav-label">Dashboard</span>
        </NuxtLink>

        <!-- Forecast & Compare -->
        <NuxtLink to="/forecast" class="nav-item" :class="{ 'nav-item--active': route.path === '/forecast' }">
          <img src="assets\icons\forecast.png" alt="Forecast" class="nav-icon">
          <span class="nav-label">Forecast Eng.</span>
        </NuxtLink>
      </div>

      <!-- ── GENERAL ───────────────────────────────── -->
      <div class="nav-section">
        <span class="nav-section-label">General</span>

        <!-- Repository -->
        <NuxtLink to="/repo" class="nav-item">
          <img src="assets\icons\data.png" alt="Dashboard" class="nav-icon">

          <span class="nav-label">Repository</span>
        </NuxtLink>

        <!-- Extract Reports -->
        <NuxtLink to="/extract" class="nav-item">
          <img src="assets\icons\extract.png" alt="Extract Reports" class="nav-icon">
          <span class="nav-label">Extract Reports</span>
        </NuxtLink>
      </div>

    </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<style scoped>
/* ── Fixed rail — full-height, vertically centers the card ──── */

/* ── Floating card ──────────────────────────────────────────── */
.sidebar-card {
  pointer-events: all;
  position: sticky;
  width: 200px;
  min-width: 200px;
  height: 80vh;
  top: 80px;
  margin-top: 80px;
  background: #ffffff;
  max-height: 880px;
  border-radius: 24px;
  padding: 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 6px  rgba(0, 0, 0, 0.04);
  overflow: hidden;
  margin-left: -180px;
  z-index: 10000;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s;
}

@media (max-width: 1440px) {
  .sidebar-card {
    position: fixed;
    top: 50%;
    left: 14px;
    margin-left: 0; /* Reset negative margin from sticky layout */
    margin-top: 0;
    transform: translateY(-50%) translateX(-180px); /* Leave a 20px visible tab handle on the left edge */
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
  }

  /* Reveal entirely when hovered or clicked/active */
  .sidebar-card:hover,
  .sidebar-card:focus-within,
  .sidebar-card:active {
    transform: translateY(-50%) translateX(0);
    box-shadow: 12px 0 40px rgba(0, 0, 0, 0.25);
  }
  
  /* Make the border match the container height when positioned fixed */
  .sidebar-card::before {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
}

/* Gradient border via pseudo-element mask */
.sidebar-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 24px;
  padding: 1.5px;
  background: var(--platform);
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 0;
  opacity: 0.4;
}

/* Keep children above the pseudo-border */
.sidebar-logo,
.nav-section {
  position: relative;
  z-index: 1;
}

/* ── Logo ────────────────────────────────────────────────────── */
.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 4px;
}

.logo-icon {
  width: 40px;
  height: 33px;
  flex-shrink: 0;
}

.logo-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.logo-org {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  letter-spacing: 0.2px;
}

.logo-product {
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 14.5px;
  font-weight: 700;
  color: #ef4444;
  letter-spacing: -0.3px;
}

/* ── Nav section ─────────────────────────────────────────────── */
.nav-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-section-label {
  font-family: 'Inter', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #94a3b8;
  text-transform: uppercase;
  padding: 0 8px;
  margin-bottom: 4px;
}

/* ── Nav item ────────────────────────────────────────────────── */
.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  text-decoration: none;
  transition: background 0.15s ease;
}

.nav-item:hover {
  background: #fef2f2;
}

.nav-item--active {
  background: #fff5f5;
}

/* ── 24×24 icon ──────────────────────────────────────────────── */
.nav-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

/* ── Label ───────────────────────────────────────────────────── */
.nav-label {
  font-family: 'Inter', 'Poppins', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
}

.nav-item--active .nav-label {
  color: #0f172a;
}
</style>