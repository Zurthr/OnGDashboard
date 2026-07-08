// stores/extractStore.ts
// All extraction state and logic lives here, matching the pattern of afeStore.ts
// and useVedaStore(): pages and components read/act through this store rather
// than holding their own state.

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

/* ── Types ────────────────────────────────────────────── */
export type Field = { value: string | number | null; reference_context: string; pages: string }
export type EquipField = { Wellhead: Field; Processing: Field; Utilities: Field }
export type ImpField = { H2S: Field; CO2: Field; Hg: Field }
export interface ExtractionJSON {
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
export type Status = 'queued' | 'processing' | 'done' | 'error'

export interface QueuedFile {
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

interface StatusResponse {
  status: string
  stage: string
  progress: number
  result?: ExtractionJSON
  error?: string
  raw_text?: string
}

const API_BASE_URL = ''
const STORAGE_KEY = 'afe_extraction_queue'
const THREE_HOURS_MS = 3 * 60 * 60 * 1000

export const useExtractStore = defineStore('extract', () => {
  /* ── State ──────────────────────────────────────────── */
  const files = ref<QueuedFile[]>([])

  /* ── Getters ────────────────────────────────────────── */
  const isBusy = computed(() => files.value.some(f => f.status === 'processing'))
  const doneCount = computed(() => files.value.filter(f => f.status === 'done').length)
  const allDone = computed(() => files.value.length > 0 && files.value.every(f => f.status === 'done'))

  /* ── Persistence ───────────────────────────────────────
     Called explicitly from the page's onMounted (not run inside the
     store body) so it never executes during SSR, where localStorage
     and window are unavailable. */
  function restoreQueue() {
    const savedQueue = localStorage.getItem(STORAGE_KEY)
    if (!savedQueue) return
    try {
      const parsedFiles: QueuedFile[] = JSON.parse(savedQueue)
      const now = Date.now()
      files.value = parsedFiles.filter(f => (now - (f.timestamp || 0)) < THREE_HOURS_MS)
      if (files.value.length === 0) localStorage.removeItem(STORAGE_KEY)
      files.value.forEach(f => {
        f.pollIntervalId = undefined
        if (f.status === 'processing' && f.jobId) pollStatus(f)
      })
    } catch (e) {
      console.error('Failed parsing saved queue:', e)
    }
  }

  watch(files, (newVal) => {
    const clearBlobs = newVal.map(({ file, pollIntervalId, ...rest }) => rest)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clearBlobs))
  }, { deep: true })

  /* ── File handling ─────────────────────────────────────*/
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

  /* ── API network actions ──────────────────────────────*/
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
        body: formData,
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
        if (f.status === 'done' || f.status === 'error') {
          clearInterval(checkInterval)
          resolve()
        }
      }, 1000)
    })
  }

  async function runAll() {
    if (isBusy.value) return
    for (const f of files.value) {
      if (f.status === 'queued' || f.status === 'error') {
        await runOne(f)
        await waitUntilDone(f)
      }
    }
  }

  function pollStatus(f: QueuedFile) {
    if (f.pollIntervalId) clearInterval(f.pollIntervalId)

    f.pollIntervalId = setInterval(async () => {
      try {
        const response = await $fetch<StatusResponse>(`${API_BASE_URL}/api/extract/status?jobId=${f.jobId}`)
        f.status = response.status as Status
        f.stage = response.stage
        f.progress = response.progress

        if (response.status === 'done') {
          if (f.pollIntervalId) clearInterval(f.pollIntervalId)
          f.result = response.result || null
          f.raw_text = response.raw_text
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
    if (f.pollIntervalId) clearInterval(f.pollIntervalId)
    f.status = 'error'
    f.error = 'Process forcefully cancelled by user.'
    f.stage = 'Cancelled'
  }

  /* ── Download & UI helpers ─────────────────────────────*/
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

  return {
    files, isBusy, doneCount, allDone,
    restoreQueue, addFiles, removeFile, clearAll,
    runOne, runAll, pollStatus, cancelExtraction,
    downloadOne, downloadAll, pretty, formatBytes, statusLabel,
  }
})
