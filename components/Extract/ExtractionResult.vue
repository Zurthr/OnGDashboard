<template>
  <div v-if="sections" class="result-grid">
    <div v-for="section in sections" :key="section.title" class="r-section">
      <div class="r-section-title">{{ section.title }}</div>
      <table class="r-table">
        <thead>
          <tr><th>Parameter</th><th>Value</th><th>Pages</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in section.rows" :key="row.label" class="r-row">
            <td class="r-label">{{ row.label }}</td>
            <td class="r-val" :class="{ 'r-empty': isEmpty(row.field) }">
              {{ isEmpty(row.field) ? 'Not Found' : row.field!.value }}
            </td>
            <td class="r-pages">{{ row.field?.pages || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div v-else class="err-msg">Malformed JSON returned from server.</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ExtractionJSON, Field } from '~/stores/extractStore'

const props = defineProps<{ data: ExtractionJSON }>()

function isEmpty(field?: Field) {
  return !field || field.value === null || field.value === undefined
}

const sections = computed(() => {
  const x = props.data?.AFE_Extraction
  if (!x) return null
  return [
    {
      title: 'Identifiers',
      rows: [
        { label: 'AFE Number', field: x.AFE_Number },
        { label: 'Project Type', field: x.Project_Type },
      ],
    },
    {
      title: 'Structural parameters',
      rows: [
        { label: 'Water Depth', field: x.Water_Depth },
        { label: 'Topside Weight', field: x.Weight_Topside },
        { label: 'Jacket Weight', field: x.Weight_Jacket },
        { label: 'Piling Weight', field: x.Piling_Weight },
        { label: 'Number of Legs', field: x.Number_of_Legs },
        { label: 'Number of Slots', field: x.Number_of_Slots },
      ],
    },
    {
      title: 'Topside Equipment',
      rows: [
        { label: 'Wellhead', field: x.Topside_Equipment?.Wellhead },
        { label: 'Processing', field: x.Topside_Equipment?.Processing },
        { label: 'Utilities', field: x.Topside_Equipment?.Utilities },
      ],
    },
    {
      title: 'Impurities',
      rows: [
        { label: 'H₂S', field: x.Impurities?.H2S },
        { label: 'CO₂', field: x.Impurities?.CO2 },
        { label: 'Hg', field: x.Impurities?.Hg },
      ],
    },
  ]
})
</script>

<style scoped>
.result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 28px; }
.r-section-title {
  font-family: 'Inter'; font-size: 10px; font-weight: 700; letter-spacing: .6px;
  text-transform: uppercase; color: #94a3b8; margin-bottom: 8px;
}
.r-table { width: 100%; border-collapse: collapse; }
.r-table th {
  text-align: left; font-family: 'Inter'; font-size: 10.5px; font-weight: 600;
  color: #cbd5e1; text-transform: uppercase; letter-spacing: .4px;
  padding: 0 8px 6px; border-bottom: 1px solid #f1f5f9;
}
.r-table th:nth-child(3) { text-align: right; }
.r-row td { padding: 7px 8px; border-bottom: 1px solid #f8fafc; font-size: 13px; }
.r-label { color: #64748b; }
.r-val { color: #0f172a; font-weight: 600; font-family: 'Inter'; }
.r-empty { color: #cbd5e1; font-weight: 500; font-style: italic; }
.r-pages { text-align: right; font-family: 'Inter'; font-size: 12px; color: #94a3b8; }
.err-msg { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #b91c1c; }

@media (max-width: 900px) {
  .result-grid { grid-template-columns: 1fr; }
}
</style>
