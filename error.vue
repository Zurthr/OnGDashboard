<template>
  <div class="error-shell">

    <div class="error-card">
      <!-- Animated location pin -->
      <div class="error-icon-wrap">
        <svg class="error-pin animate-float" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 4C16.27 4 10 10.27 10 18c0 10.5 14 28 14 28s14-17.5 14-28c0-7.73-6.27-14-14-14z"
                fill="#fb923c" fill-opacity="0.25"/>
          <path d="M24 4C16.27 4 10 10.27 10 18c0 10.5 14 28 14 28s14-17.5 14-28c0-7.73-6.27-14-14-14z"
                stroke="#ef4444" stroke-width="2"/>
          <circle cx="24" cy="18" r="6" fill="#ef4444"/>
          <circle cx="24" cy="18" r="2.5" fill="#ffffff"/>
          <line x1="19" y1="13" x2="29" y2="23" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="29" y1="13" x2="19" y2="23" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        <div class="error-code">{{ statusCode }}</div>
      </div>

      <div class="error-divider"></div>

      <h1 class="error-title">{{ title }}</h1>
      <p class="error-description">
        {{ description }}
      </p>

      <div class="error-actions">
        <button class="btn-primary" @click="handleBack">
          Back to Dashboard
        </button>
      </div>

      <!-- Technical detail for non-404 errors -->
      <p v-if="statusCode !== 404 && errorMessage" class="error-detail">
        {{ errorMessage }}
      </p>
    </div>

    <p class="error-footer">SKK Migas · Cost Estimation Platform</p>
  </div>
</template>

<script setup lang="ts">
// Nuxt 3: use useError() instead of defineProps to avoid hasOwnProperty on null-prototype H3Error objects
const nuxtError = useError()
const router = useRouter()

// Safely extract values — don't spread/proxy the raw error object
const statusCode = computed(() => nuxtError.value?.statusCode ?? 404)
const errorMessage = computed(() => nuxtError.value?.message ?? nuxtError.value?.statusMessage ?? '')

const title = computed(() => {
  const code = statusCode.value
  if (code === 404) return 'Page Not Found'
  if (code === 403) return 'Access Denied'
  if (code === 500) return 'Server Error'
  return 'Something Went Wrong'
})

const description = computed(() => {
  const code = statusCode.value
  if (code === 404) return 'The page you\'re looking for doesn\'t exist or has been moved. Navigate back using the sidebar or return to the dashboard.'
  if (code === 403) return 'You don\'t have permission to access this page. Please contact an administrator.'
  return 'An unexpected error occurred. Please try again or return to the dashboard.'
})

useHead({
  title: `${statusCode.value} — SKK Migas`,
  meta: [{ name: 'robots', content: 'noindex' }]
})

const handleBack = async () => {
  await clearError({ redirect: '/' })
}

const handleForecast = async () => {
  await clearError({ redirect: '/forecast' })
}
</script>

<style>
body { margin: 0; }
</style>

<style scoped>
.error-shell {
  min-height: 100vh;
  background-color: #f4f4f0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  position: relative;
  overflow: hidden;
  font-family: 'Inter', 'Poppins', sans-serif;
}

/* ── Background blobs ── */
.bg-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.25;
  pointer-events: none;
}

.bg-blob-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, #fb923c 0%, transparent 70%);
  top: -120px; right: -100px;
  animation: blobDrift 12s ease-in-out infinite alternate;
}

.bg-blob-2 {
  width: 380px; height: 380px;
  background: radial-gradient(circle, #fca5a5 0%, transparent 70%);
  bottom: -80px; left: -80px;
  animation: blobDrift 16s ease-in-out infinite alternate-reverse;
}

@keyframes blobDrift {
  from { transform: translate(0, 0) scale(1); }
  to   { transform: translate(30px, 20px) scale(1.08); }
}

.error-card {
  position: relative;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 28px;
  padding: 52px 56px;
  max-width: 520px;
  width: 100%;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02), 0 12px 40px rgba(0,0,0,0.07);
  z-index: 1;
}

.error-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  border-radius: 28px 28px 0 0;
  background: var(--platform, linear-gradient(90deg, #ef4444, #fb923c, #facc15));
  opacity: 0.9;
}

/* ── Icon + code ── */
.error-icon-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.error-pin {
  width: 64px; height: 64px;
}

.animate-float {
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}

.error-code {
  font-size: 72px;
  font-weight: 900;
  line-height: 1;
  letter-spacing: -4px;
  background: linear-gradient(135deg, #ef4444 10%, #fb923c 60%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Divider ── */
.error-divider {
  height: 1px;
  background: #f1f5f9;
  margin: 24px 0;
}

/* ── Text ── */
.error-title {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.5px;
  margin: 0 0 12px;
}

.error-description {
  font-size: 14.5px;
  color: #64748b;
  line-height: 1.65;
  margin: 0;
}

/* ── Buttons ── */
.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 32px;
}

.btn-primary,
.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border-radius: 99px;
  padding: 11px 22px;
  font-size: 13.5px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  border: none;
  font-family: inherit;
}

.btn-primary {
  background: var(--platform2, linear-gradient(135deg, #fb923c, #fca5a5));
  color: #261812;
  box-shadow: 0 4px 14px rgba(251, 146, 60, 0.25);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(251, 146, 60, 0.35);
}

.btn-secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.btn-secondary:hover {
  background: #e2e8f0;
  color: #1e293b;
  transform: translateY(-2px);
}

.btn-icon {
  width: 15px; height: 15px;
}

/* ── Error detail ── */
.error-detail {
  margin-top: 20px;
  font-size: 12px;
  color: #94a3b8;
  font-family: 'Courier New', monospace;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 14px;
  word-break: break-word;
}

/* ── Footer ── */
.error-footer {
  position: relative;
  z-index: 1;
  margin-top: 32px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
  letter-spacing: 0.2px;
}
</style>
