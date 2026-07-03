<template>
    <div class="sidebar-card">

      <!-- ── Logo ─────────────────────────────────── -->
      <div class="sidebar-logo">
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                fill="#fb923c" fill-opacity="0.3"/>
          <circle cx="12" cy="9" r="3.5" fill="#ef4444"/>
          <circle cx="12" cy="9" r="1.5" fill="#ffffff"/>
        </svg>
        <div class="logo-text">
          <span class="logo-org">SKK Migas</span>
          <span class="logo-product">Cost Estimation</span>
        </div>
      </div>

      <!-- ── PLATFORM ──────────────────────────────── -->
      <div class="nav-section">
        <span class="nav-section-label">Platform</span>

        <!-- Dashboard -->
        <button class="nav-item nav-item--active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="8" height="8" rx="2" fill="#fb923c"/>
            <rect x="13" y="3" width="8" height="8" rx="2" fill="#fca5a5"/>
            <rect x="3" y="13" width="8" height="8" rx="2" fill="#fca5a5"/>
            <rect x="13" y="13" width="8" height="8" rx="2" fill="#ef4444"/>
          </svg>
          <span class="nav-label">Dashboard</span>
        </button>

        <!-- Forecast & Compare -->
        <button class="nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3"  y="3"  width="7.5" height="7.5" rx="2" fill="#fb923c"/>
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" fill="#fca5a5"/>
            <rect x="3"  y="13.5" width="7.5" height="7.5" rx="2" fill="#fca5a5"/>
            <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" fill="#ef4444"/>
            <line x1="10.5" y1="6.75" x2="13.5" y2="6.75" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
            <line x1="10.5" y1="17.25" x2="13.5" y2="17.25" stroke="white" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span class="nav-label">Forecast &amp; Compare</span>
        </button>
      </div>

      <!-- ── GENERAL ───────────────────────────────── -->
      <div class="nav-section">
        <span class="nav-section-label">General</span>

        <!-- Database -->
        <button class="nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="12" cy="5.5" rx="7" ry="2.5" fill="#fb923c"/>
            <path d="M5 5.5v5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-5" fill="#fca5a5" fill-opacity="0.6"/>
            <path d="M5 10.5v5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-5" fill="#ef4444" fill-opacity="0.4"/>
            <ellipse cx="12" cy="5.5" rx="7" ry="2.5" fill="none" stroke="#ef4444" stroke-width="1.2"/>
          </svg>
          <span class="nav-label">Database</span>
        </button>

        <!-- Extract Reports -->
        <button class="nav-item">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="3" width="14" height="18" rx="2" fill="#fca5a5" fill-opacity="0.4"/>
            <rect x="4" y="3" width="14" height="7" rx="2" fill="#fb923c"/>
            <line x1="7" y1="13.5" x2="17" y2="13.5" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="7" y1="17"   x2="13" y2="17"   stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="14.5,15.5 17.5,18.5 14.5,21.5" stroke="#ef4444" stroke-width="1.5"
                      stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="nav-label">Extract Reports</span>
        </button>
      </div>

    </div>
</template>

<script setup lang="ts">
// No JS logic required — pure presentational component
</script>

<style scoped>
/* ── Fixed rail — full-height, vertically centers the card ──── */

/* ── Floating card ──────────────────────────────────────────── */
.sidebar-card {
  pointer-events: all;
  position: sticky;
  width: 240px;
  min-width:240px;
  height: 80vh;
  top:80px;
  margin-top: 80px;
  background: #ffffff;
  max-height:880px;
  border-radius: 24px;
  padding: 24px 14px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 6px  rgba(0, 0, 0, 0.04);
  overflow: hidden;
  margin-left:-240px;
}

/* Gradient border via pseudo-element mask */
.sidebar-card::before {
    height: 80vh;
      max-height:880px;
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
  gap: 10px;
}

.logo-icon {
  width: 32px;
  height: 32px;
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