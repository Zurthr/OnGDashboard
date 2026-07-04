<template>
  <div class="welcome-container">
    <div class="welcome-card">
      <div class="welcome-header">
        <svg class="welcome-icon animate-float" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                fill="#fb923c" fill-opacity="0.3"/>
          <circle cx="12" cy="9" r="3.5" fill="#ef4444"/>
          <circle cx="12" cy="9" r="1.5" fill="#ffffff"/>
        </svg>
        <h1 class="welcome-title">SKK Migas</h1>
        <p class="welcome-subtitle">Upstream Oil & Gas Regulatory System</p>
      </div>

      <div class="welcome-divider"></div>

      <div class="welcome-body">
        <p class="welcome-text">
          Welcome to the Cost Estimation &amp; CAPEX Benchmarking Platform. Please use the floating sidebar on the left to navigate between modules.
        </p>

        <!-- Dynamic Action Button pointing to navigation drawer -->
        <button class="nav-hint-btn" @click="focusSidebar">
          <Icon name="heroicons:arrow-left-20-solid" class="btn-arrow-icon" />
          <span>Click sidebar to switch to the relevant pages</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'SKK Migas - Cost Estimation Home',
  meta: [
    { name: 'description', content: 'Upstream Oil & Gas Regulatory System portal.' }
  ]
})

const focusSidebar = () => {
  // Try to find the sidebar element and briefly flash it or focus it for UX
  const sidebar = document.querySelector('.sidebar-card')
  if (sidebar) {
    sidebar.classList.add('flash-highlight')
    setTimeout(() => {
      sidebar.classList.remove('flash-highlight')
    }, 1200)
  }
}
</script>

<style scoped>
.welcome-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  width: 1064px;
  max-width: 1064px;
  padding: 40px;
  box-sizing: border-box;
}

.welcome-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  padding: 48px;
  max-width: 580px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.welcome-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--platform);
  opacity: 0.8;
}

.welcome-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.welcome-icon {
  width: 56px;
  height: 56px;
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.welcome-title {
  font-family: 'Poppins', 'Inter', sans-serif;
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.5px;
}

.welcome-subtitle {
  font-size: 14px;
  color: #64748b;
  font-weight: 500;
}

.welcome-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 32px 0;
}

.welcome-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.welcome-text {
  font-size: 15px;
  color: #475569;
  line-height: 1.6;
}

/* Hint Button styling */
.nav-hint-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--platform2);
  color: #261812;
  border: none;
  border-radius: 99px;
  padding: 12px 24px;
  font-size: 13.5px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(251, 146, 60, 0.2);
  transition: all 0.2s ease;
  outline: none;
}

.nav-hint-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(251, 146, 60, 0.3);
}

.nav-hint-btn:active {
  transform: translateY(0);
}

.btn-arrow-icon {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}

.nav-hint-btn:hover .btn-arrow-icon {
  transform: translateX(-4px);
}
</style>

<!-- Global helper for the flashing sidebar hint -->
<style>
@keyframes borderFlash {
  0%, 100% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  }
  50% {
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.5), 0 0 0 4px rgba(239, 68, 68, 0.15);
    transform: scale(1.02);
  }
}

.flash-highlight {
  animation: borderFlash 1.2s ease-in-out;
}
</style>
