<template>
  <div class="page">
    <div class="page-head">
      <div>
        <span class="eyebrow">AFE Module</span>
        <h1 class="page-title">Extract AFE Data</h1>
        <p class="page-sub">
          Upload one or more AFE documents (PDF). Each file is processed locally,
          then returned as structured JSON for review and hand-off.
        </p>
      </div>
    </div>

    <section class="card upload-card">
      <span class="card-bar"></span>

      <div
        class="dropzone"
        :class="{ 'dropzone--active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
        @click="fileInput?.click()"
      >
        <Icon name="heroicons:cloud-arrow-up" class="dz-icon" />
        <p class="dz-title">Drop AFE PDFs here or <span>browse</span></p>
        <p class="dz-hint">PDF only · digital or scanned · multiple files supported</p>
        <input
          ref="fileInput"
          type="file"
          accept="application/pdf"
          multiple
          hidden
          @change="onSelect"
        />
      </div>

      <p class="privacy-note">
        <Icon name="heroicons:lock-closed" class="note-icon" />
        Files are processed temporarily on the local server and are not stored permanently.
      </p>
    </section>

    <section v-if="files.length" class="card queue-card">
      <div class="card-head">
        <div>
          <span class="section-label">Queue</span>
          <h2 class="card-title">{{ files.length }} file{{ files.length > 1 ? 's' : '' }}</h2>
        </div>
        <div class="head-actions">
          <button class="btn btn-ghost" @click="clearAll" :disabled="isBusy">
            <Icon name="heroicons:trash" class="btn-ic" /> Clear
          </button>
          <button class="btn btn-primary" @click="runAll" :disabled="isBusy || allDone">
            <Icon name="heroicons:bolt" class="btn-ic" />
            {{ isBusy ? 'Extracting…' : 'Extract all' }}
          </button>
        </div>
      </div>

      <ul class="file-list">
        <li v-for="f in files" :key="f.id" class="file-row">
          <div class="file-main">
            <Icon name="heroicons:document-text" class="file-ic" />
            <div class="file-meta">
              <span class="file-name">{{ f.name }}</span>
              <span class="file-size">{{ formatBytes(f.size) }}</span>
            </div>
            <span class="status" :class="'status--' + f.status">
              <span class="dot"></span>{{ statusLabel(f.status) }}
            </span>
            
            <div class="row-actions">
              <button
                v-if="f.status === 'done'"
                class="icon-btn"
                title="Download JSON"
                @click="downloadOne(f)"
              >
                <Icon name="heroicons:arrow-down-tray" />
              </button>
              
              <button
                v-if="f.status === 'processing'"
                class="icon-btn stop-btn"
                title="Force Cancel"
                @click="cancelExtraction(f)"
              >
                <Icon name="heroicons:stop-circle" />
              </button>

              <button
                v-if="f.status !== 'processing'"
                class="icon-btn"
                title="Remove"
                @click="removeFile(f.id)"
              >
                <Icon name="heroicons:x-mark" />
              </button>
            </div>
          </div>

          <div v-if="f.status === 'processing'" class="progress">
            <div class="progress-bar" :style="{ width: f.progress + '%' }"></div>
          </div>
          <p v-if="f.status === 'processing'" class="progress-stage">{{ f.stage }}</p>

          <p v-if="f.status === 'error'" class="err-msg">
            <Icon name="heroicons:exclamation-triangle" class="err-ic" /> {{ f.error }}
          </p>

          <div v-if="f.status === 'done' && (f.result || f.raw_text)" class="result">
            
            <ExtractionResult v-if="f.result" :data="f.result" />
            
            <div v-if="!f.result && f.raw_text" class="err-msg" style="margin-bottom: 12px;">
              <Icon name="heroicons:exclamation-triangle" class="err-ic" /> 
              The AI generated invalid data formatting. Showing raw text output below.
            </div>

            <button class="raw-toggle" @click="f.showRaw = !f.showRaw">
              <Icon
                :name="f.showRaw ? 'heroicons:chevron-down' : 'heroicons:chevron-right'"
                class="raw-chev"
              />
              {{ f.showRaw ? 'Hide' : 'Show' }} raw output
            </button>
            
            <pre v-if="f.showRaw" class="raw-json">{{ f.result ? pretty(f.result) : f.raw_text }}</pre>
          </div>
        </li>
      </ul>

      <div v-if="doneCount > 1" class="footer-actions">
        <button class="btn btn-ghost" @click="downloadAll">
          <Icon name="heroicons:archive-box-arrow-down" class="btn-ic" />
          Download all JSON
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, defineComponent, onMounted, watch } from 'vue'

useHead({ title: 'SKK Migas — Extract AFE Data' })

/* ───────────────────────────────────────────────────────────
   TYPES
   ─────────────────────────────────────────────────────────── */
type Field = { value: string | number | null; reference_context: string; pages: string }
type EquipField = { Wellhead: Field; Processing: Field; Utilities: Field }
type ImpField = { H2S: Field; CO2: Field; Hg: Field }
interface ExtractionJSON {
  AFE_Extraction: {
    AFE_Number: Field
    Project_Type: Field
    Water_Depth: Field
    Weight_Topside: Field
    Weight_Jacket: Field
    Piling_Weight: Field
    Number_of_Legs: Field
    Number_of_Slots: Field
    Topside_Equipment: EquipField
    Impurities: ImpField
  }
}
type Status = 'queued' | 'processing' | 'done' | 'error'

interface QueuedFile {
  id: string
  jobId?: string
  name: string
  size: number
  file?: File
  status: Status
  progress: number
  stage: string
  result: ExtractionJSON | null
  error: string
  showRaw: boolean
  pollIntervalId?: any
  timestamp: number
  raw_text?: string
}

// Expected response format from the new Python API
interface StatusResponse {
  status: string
  stage: string
  progress: number
  result?: ExtractionJSON
  error?: string
  raw_text?: string
}

/* ───────────────────────────────────────────────────────────
   STATE & PERSISTENCE
   ─────────────────────────────────────────────────────────── */
const files = ref<QueuedFile[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

const isBusy = computed(() => files.value.some(f => f.status === 'processing'))
const doneCount = computed(() => files.value.filter(f => f.status === 'done').length)
const allDone = computed(() => files.value.length > 0 && files.value.every(f => f.status === 'done'))

const API_BASE_URL = ''

onMounted(() => {
  const savedQueue = localStorage.getItem('afe_extraction_queue')
  if (savedQueue) {
    try {
      const parsedFiles: QueuedFile[] = JSON.parse(savedQueue)
      const now = Date.now()
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000 // 3 hours in milliseconds

      // NEW: Only keep files that are younger than 3 hours
      files.value = parsedFiles.filter(f => (now - (f.timestamp || 0)) < THREE_HOURS_MS)

      // If everything was too old, clean out the storage entirely
      if (files.value.length === 0) {
        localStorage.removeItem('afe_extraction_queue')
      }

      files.value.forEach(f => {
        f.pollIntervalId = undefined 
        if (f.status === 'processing' && f.jobId) pollStatus(f)
      })
    } catch (e) {
      console.error('Failed parsing saved queue:', e)
    }
  }
})

watch(files, (newVal) => {
  // Strip out the non-serializable objects (File, Timer IDs) before saving
  const clearBlobs = newVal.map(({ file, pollIntervalId, ...rest }) => rest)
  localStorage.setItem('afe_extraction_queue', JSON.stringify(clearBlobs))
}, { deep: true })

/* ───────────────────────────────────────────────────────────
   FILE HANDLING
   ─────────────────────────────────────────────────────────── */
function onSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) addFiles(Array.from(input.files))
  input.value = ''
}
function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files) addFiles(Array.from(e.dataTransfer.files))
}
function addFiles(list: File[]) {
  for (const file of list) {
    if (file.type !== 'application/pdf') continue
    files.value.push({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      file,
      status: 'queued',
      progress: 0,
      stage: 'Waiting in queue',
      result: null,
      error: '',
      showRaw: false,
      timestamp: Date.now(),
    })
  }
}
function removeFile(id: string) { files.value = files.value.filter(f => f.id !== id) }
function clearAll() { if (!isBusy.value) files.value = [] }

/* ───────────────────────────────────────────────────────────
   API NETWORK ACTIONS
   ─────────────────────────────────────────────────────────── */
async function runOne(f: QueuedFile) {
  if (!f.file) {
    f.status = 'error'
    f.error = 'File source missing. Please re-upload.'
    return
  }

  f.status = 'processing'
  f.progress = 5
  f.stage = 'Connecting to server...'
  f.error = ''

  try {
    const formData = new FormData()
    formData.append('file', f.file)

    const startResponse = await $fetch<{ jobId: string }>(`${API_BASE_URL}/api/extract/start`, {
      method: 'POST',
      body: formData
    })

    f.jobId = startResponse.jobId
    pollStatus(f)
  } catch (e: any) {
    f.status = 'error'
    f.error = e?.data?.detail || e?.message || 'Server connection failed.'
  }
}

function waitUntilDone(f: QueuedFile) {
  return new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      // If the API finishes, OR if you hit the Force Cancel button
      if (f.status === 'done' || f.status === 'error') {
        clearInterval(checkInterval)
        resolve()
      }
    }, 1000) // Check every 1 second
  })
}

async function runAll() {
  // NEW: Hard block to prevent double-clicks or phantom triggers
  if (isBusy.value) return 

  for (const f of files.value) {
    if (f.status === 'queued' || f.status === 'error') {
      await runOne(f) // Step 1: Upload and start polling
      await waitUntilDone(f) // Step 2: Halt the loop until finished
    }
  }
}

function pollStatus(f: QueuedFile) {
  // Clear any existing polling timer for this file just in case
  if (f.pollIntervalId) clearInterval(f.pollIntervalId)

  f.pollIntervalId = setInterval(async () => {
    try {
      const response = await $fetch<StatusResponse>(`${API_BASE_URL}/api/extract/status?jobId=${f.jobId}`)

      // Apply the exact API state directly to the Vue component
      f.status = response.status as Status
      f.stage = response.stage
      f.progress = response.progress

      if (response.status === 'done') {
        if (f.pollIntervalId) clearInterval(f.pollIntervalId)
        f.result = response.result || null
        f.raw_text = response.raw_text // <--- NEW: Save the raw string
      } else if (response.status === 'error') {
        if (f.pollIntervalId) clearInterval(f.pollIntervalId)
        f.error = response.error || 'Server error encountered.'
      }

    } catch (e: any) {
      console.warn('Polling error:', e)
    }
  }, 3000)
}

function cancelExtraction(f: QueuedFile) {
  if (f.pollIntervalId) {
    clearInterval(f.pollIntervalId)
  }
  f.status = 'error'
  f.error = 'Process forcefully cancelled by user.'
  f.stage = 'Cancelled'
}

/* ───────────────────────────────────────────────────────────
   DOWNLOAD & UI HELPERS
   ─────────────────────────────────────────────────────────── */
function downloadOne(f: QueuedFile) {
  const blob = new Blob([pretty(f.result)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = f.name.replace(/\.pdf$/i, '') + '_extracted.json'
  a.click()
  URL.revokeObjectURL(url)
}
function downloadAll() { files.value.filter(f => f.status === 'done').forEach(downloadOne) }
const pretty = (o: unknown) => JSON.stringify(o, null, 2)
function formatBytes(b: number) {
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(1) + ' MB'
}
function statusLabel(s: Status) {
  return { queued: 'Queued', processing: 'Processing', done: 'Done', error: 'Error' }[s]
}

/* ───────────────────────────────────────────────────────────
   RESULT TABLE COMPONENT
   ─────────────────────────────────────────────────────────── */
const ExtractionResult = defineComponent({
  props: { data: { type: Object, required: true } },
  setup(props) {
    const d = () => (props.data as ExtractionJSON).AFE_Extraction
    const row = (label: string, field?: Field) =>
      h('tr', { class: 'r-row' }, [
        h('td', { class: 'r-label' }, label),
        (!field || field.value === null || field.value === undefined)
          ? h('td', { class: 'r-val r-empty' }, 'Not Found')
          : h('td', { class: 'r-val' }, String(field.value)),
        h('td', { class: 'r-pages' }, field?.pages || '—'),
      ])
    const section = (title: string, rows: any[]) =>
      h('div', { class: 'r-section' }, [
        h('div', { class: 'r-section-title' }, title),
        h('table', { class: 'r-table' }, [
          h('thead', {}, h('tr', {}, [h('th', 'Parameter'), h('th', 'Value'), h('th', 'Pages')])),
          h('tbody', {}, rows),
        ]),
      ])
    return () => {
      const x = d()
      if (!x) return h('div', { class: 'err-msg' }, 'Malformed JSON returned from server.')
      
      return h('div', { class: 'result-grid' }, [
        section('Identifiers', [row('AFE Number', x.AFE_Number), row('Project Type', x.Project_Type)]),
        section('Structural parameters', [
          row('Water Depth', x.Water_Depth),
          row('Topside Weight', x.Weight_Topside),
          row('Jacket Weight', x.Weight_Jacket),
          row('Piling Weight', x.Piling_Weight),
          row('Number of Legs', x.Number_of_Legs),
          row('Number of Slots', x.Number_of_Slots),
        ]),
        section('Topside Equipment', [
          row('Wellhead', x.Topside_Equipment?.Wellhead || {} as Field),
          row('Processing', x.Topside_Equipment?.Processing || {} as Field),
          row('Utilities', x.Topside_Equipment?.Utilities || {} as Field),
        ]),
        section('Impurities', [
          row('H₂S', x.Impurities?.H2S || {} as Field),
          row('CO₂', x.Impurities?.CO2 || {} as Field),
          row('Hg', x.Impurities?.Hg || {} as Field),
        ]),
      ])
    }
  },
})
</script>

<style scoped>
.page {
  width: 1064px;
  max-width: 1064px;
  padding: 48px 32px 80px;
  box-sizing: border-box;
}

/* ── Header ─────────────────────────────────────────────── */
.page-head { margin-bottom: 28px; }
.eyebrow {
  font-family: 'Inter', sans-serif;
  font-size: 11px; font-weight: 700; letter-spacing: 1px;
  text-transform: uppercase; color: #94a3b8;
}
.page-title {
  font-family: 'Poppins', sans-serif;
  font-size: 30px; font-weight: 800; letter-spacing: -0.6px;
  color: #0f172a; margin-top: 4px;
}
.page-sub {
  font-size: 14.5px; color: #64748b; max-width: 620px;
  margin-top: 8px; line-height: 1.6;
}

/* ── Card shell ─────────────────────────────────────────── */
.card {
  position: relative;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.03);
  padding: 28px;
  margin-bottom: 10px;
  overflow: hidden;
}

/* ── Dropzone ───────────────────────────────────────────── */
.dropzone {
  border: 2px dashed #e2e8f0;
  border-radius: 18px;
  padding: 44px 24px;
  text-align: center;
  cursor: pointer;
  transition: all .2s ease;
  background: #fcfcfd;
}
.dropzone:hover { border-color: #fca5a5; background: #fffafb; }
.dropzone--active { border-color: #ef4444; background: #fff5f5; }
.dz-icon { width: 42px; height: 42px; color: #fb923c; }
.dz-title { font-family: 'Poppins'; font-weight: 600; font-size: 15.5px; color: #1e293b; margin-top: 10px; }
.dz-title span { color: #ef4444; text-decoration: underline; }
.dz-hint { font-size: 12.5px; color: #94a3b8; margin-top: 4px; }
.privacy-note {
  display: flex; align-items: center; gap: 6px; justify-content: center;
  font-size: 12px; color: #94a3b8; margin-top: 16px;
}
.note-icon { width: 13px; height: 13px; }

/* ── Card head ──────────────────────────────────────────── */
.card-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; }
.section-label {
  font-family: 'Inter'; font-size: 10px; font-weight: 700; letter-spacing: .8px;
  text-transform: uppercase; color: #94a3b8;
}
.card-title { font-family: 'Poppins'; font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
.head-actions { display: flex; gap: 10px; }

/* ── Buttons ────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 7px;
  border: none; border-radius: 12px; padding: 10px 18px;
  font-family: 'Inter'; font-size: 13.5px; font-weight: 600;
  cursor: pointer; transition: all .18s ease;
}
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-ic { width: 16px; height: 16px; }
.btn-primary { background: var(--color-primary, #10b981); color: #fff; }
.btn-primary:not(:disabled):hover { background: var(--color-primary-hover, #059669); transform: translateY(-1px); }
.btn-ghost { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
.btn-ghost:not(:disabled):hover { background: #f1f5f9; }

/* ── File list ──────────────────────────────────────────── */
.file-list { list-style: none; display: flex; flex-direction: column; gap: 14px; }
.file-row { border: 1px solid #f1f5f9; border-radius: 16px; padding: 14px 16px; background: #fcfcfd; }
.file-main { display: flex; align-items: center; gap: 12px; }
.file-ic { width: 22px; height: 22px; color: #fb923c; flex-shrink: 0; }
.file-meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.file-name { font-weight: 600; font-size: 14px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-size { font-family: 'Inter'; font-size: 11.5px; color: #94a3b8; }

/* ── Status pill ────────────────────────────────────────── */
.status {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: 'Inter'; font-size: 11.5px; font-weight: 600;
  padding: 4px 10px; border-radius: 99px; white-space: nowrap;
}
.status .dot { width: 6px; height: 6px; border-radius: 50%; }
.status--queued { background: #f1f5f9; color: #64748b; }
.status--queued .dot { background: #94a3b8; }
.status--processing { background: #fffbeb; color: #b45309; }
.status--processing .dot { background: #f59e0b; animation: pulse 1.4s infinite; }
.status--done { background: #ecfdf5; color: #047857; }
.status--done .dot { background: #10b981; }
.status--error { background: #fef2f2; color: #b91c1c; }
.status--error .dot { background: #ef4444; }

.row-actions { display: flex; gap: 4px; }
.icon-btn {
  display: grid; place-items: center; width: 30px; height: 30px;
  border: none; background: transparent; border-radius: 8px; cursor: pointer;
  color: #94a3b8; transition: all .15s;
}
.icon-btn:hover:not(:disabled) { background: #f1f5f9; color: #475569; }
.icon-btn :deep(svg) { width: 17px; height: 17px; }
.icon-btn:disabled { opacity: .4; cursor: not-allowed; }

/* ── Progress ───────────────────────────────────────────── */
.progress { height: 6px; background: #f1f5f9; border-radius: 99px; margin-top: 14px; overflow: hidden; }
.progress-bar { height: 100%; background: var(--platform); border-radius: 99px; transition: width .4s ease; }
.progress-stage { font-family: 'Inter'; font-size: 11.5px; color: #94a3b8; margin-top: 6px; }
.err-msg { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #b91c1c; margin-top: 12px; }
.err-ic { width: 15px; height: 15px; }

/* ── Result ─────────────────────────────────────────────── */
.result { margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
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
:deep(.r-row) td { padding: 7px 8px; border-bottom: 1px solid #f8fafc; font-size: 13px; }
:deep(.r-label) { color: #64748b; }
:deep(.r-val) { color: #0f172a; font-weight: 600; font-family: 'Inter'; }
:deep(.r-empty) { color: #cbd5e1; font-weight: 500; font-style: italic; }
:deep(.r-pages) { text-align: right; font-family: 'Inter'; font-size: 12px; color: #94a3b8; }

/* ── Raw JSON ───────────────────────────────────────────── */
.raw-toggle {
  display: inline-flex; align-items: center; gap: 5px; margin-top: 16px;
  background: none; border: none; cursor: pointer;
  font-family: 'Inter'; font-size: 12.5px; font-weight: 600; color: #64748b;
}
.raw-toggle:hover { color: #ef4444; }
.raw-chev { width: 15px; height: 15px; }
.raw-json {
  margin-top: 10px; background: #0f172a; color: #e2e8f0;
  border-radius: 12px; padding: 16px; font-size: 12px; line-height: 1.6;
  font-family: 'SF Mono', 'Consolas', monospace; overflow-x: auto; white-space: pre;
}
.footer-actions { margin-top: 20px; display: flex; justify-content: flex-end; }

@media (max-width: 900px) {
  .page { width: 100%; }
  .result-grid { grid-template-columns: 1fr; }
}
</style>