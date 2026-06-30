<template>
  <div class="comparison-card">
    <!-- Inline SVG Chart Illustration -->
    <div class="chart-wrapper">
      <svg viewBox="0 0 300 180" class="svg-chart" xmlns="http://www.w3.org/2000/svg">
        <!-- Connecting curvy wave in background -->
        <path 
          d="M 15 110 C 50 60, 70 120, 110 80 C 150 40, 180 130, 220 70 C 250 30, 260 110, 285 55" 
          fill="none" 
          stroke="#bbf7d0" 
          stroke-width="3" 
          stroke-linecap="round"
          opacity="0.8"
        />
        
        <!-- Vertical rounded capsule bars (pills) -->
        <!-- Grouped for easy styling -->
        <g class="chart-pills">
          <!-- Pill 1 -->
          <rect x="20" y="80" width="8" height="60" rx="4" fill="#a3e635" opacity="0.6" />
          <circle cx="24" cy="80" r="3" fill="#84cc16" />
          <circle cx="24" cy="140" r="3" fill="#84cc16" />

          <!-- Pill 2 -->
          <rect x="38" y="50" width="8" height="95" rx="4" fill="#cbd5e1" opacity="0.5" />

          <!-- Pill 3 -->
          <rect x="56" y="65" width="8" height="85" rx="4" fill="#facc15" opacity="0.6" />
          <circle cx="60" cy="65" r="3" fill="#ca8a04" />
          <circle cx="60" cy="150" r="3" fill="#ca8a04" />

          <!-- Pill 4 -->
          <rect x="74" y="40" width="8" height="100" rx="4" fill="#a3e635" opacity="0.6" />
          <circle cx="78" cy="40" r="3" fill="#84cc16" />
          <circle cx="78" cy="140" r="3" fill="#84cc16" />

          <!-- Pill 5 -->
          <rect x="92" y="85" width="8" height="65" rx="4" fill="#fca5a5" opacity="0.7" />
          <circle cx="96" cy="85" r="3" fill="#ef4444" opacity="0.8" />
          <circle cx="96" cy="150" r="3" fill="#ef4444" opacity="0.8" />

          <!-- Pill 6 -->
          <rect x="110" y="55" width="8" height="95" rx="4" fill="#cbd5e1" opacity="0.5" />

          <!-- Pill 7 -->
          <rect x="128" y="35" width="8" height="110" rx="4" fill="#a3e635" opacity="0.7" />
          <circle cx="132" cy="35" r="3" fill="#84cc16" />
          <circle cx="132" cy="145" r="3" fill="#84cc16" />

          <!-- Pill 8 -->
          <rect x="146" y="70" width="8" height="70" rx="4" fill="#cbd5e1" opacity="0.5" />

          <!-- Pill 9 -->
          <rect x="164" y="45" width="8" height="100" rx="4" fill="#facc15" opacity="0.6" />
          <circle cx="168" cy="45" r="3" fill="#ca8a04" />
          <circle cx="168" cy="145" r="3" fill="#ca8a04" />

          <!-- Pill 10 -->
          <rect x="182" y="75" width="8" height="70" rx="4" fill="#a3e635" opacity="0.6" />
          <circle cx="186" cy="75" r="3" fill="#84cc16" />
          <circle cx="186" cy="145" r="3" fill="#84cc16" />

          <!-- Pill 11 -->
          <rect x="200" y="50" width="8" height="90" rx="4" fill="#fca5a5" opacity="0.7" />
          <circle cx="204" cy="50" r="3" fill="#ef4444" opacity="0.8" />
          <circle cx="204" cy="140" r="3" fill="#ef4444" opacity="0.8" />

          <!-- Pill 12 -->
          <rect x="218" y="80" width="8" height="60" rx="4" fill="#cbd5e1" opacity="0.5" />

          <!-- Pill 13 -->
          <rect x="236" y="60" width="8" height="90" rx="4" fill="#a3e635" opacity="0.6" />
          <circle cx="240" cy="60" r="3" fill="#84cc16" />
          <circle cx="240" cy="150" r="3" fill="#84cc16" />

          <!-- Pill 14 -->
          <rect x="254" y="30" width="8" height="115" rx="4" fill="#facc15" opacity="0.6" />
          <circle cx="258" cy="30" r="3" fill="#ca8a04" />
          <circle cx="258" cy="145" r="3" fill="#ca8a04" />

          <!-- Pill 15 -->
          <rect x="272" y="65" width="8" height="80" rx="4" fill="#a3e635" opacity="0.6" />
          <circle cx="276" cy="65" r="3" fill="#84cc16" />
          <circle cx="276" cy="145" r="3" fill="#84cc16" />
        </g>
      </svg>
    </div>

    <!-- Text content -->
    <div class="content-wrapper">
      <h3 class="title">Add Comparison</h3>
      <p class="description">
        Get additional insights with added parameters from <em>KKKS Offers.</em>
      </p>
    </div>
  </div>
</template>

<style scoped>
.comparison-card {
  background: linear-gradient(180deg, #ecfccb 0%, #d9f99d 100%);
  border: 2.5px dashed #a3e635;
  border-radius: var(--border-radius-xl);
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  text-align: center;
  height: 100%;
  box-shadow: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.comparison-card:hover {
  transform: translateY(-2px);
  border-color: #84cc16;
  background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
}

.chart-wrapper {
  width: 100%;
  max-width: 280px;
  margin-top: 10px;
  margin-bottom: auto;
  display: flex;
  justify-content: center;
  align-items: center;
}

.svg-chart {
  width: 100%;
  height: auto;
  overflow: visible;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.title {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.5px;
  line-height: 1.1;
}

.description {
  font-size: 14px;
  color: #334155;
  line-height: 1.4;
  max-width: 240px;
}

em {
  font-style: italic;
  font-weight: 400;
}
</style>
