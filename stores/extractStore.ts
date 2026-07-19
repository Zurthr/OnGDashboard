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
    Topside_Weight: Field
    Jacket_Weight: Field
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
  imported?: boolean // true once this file has been successfully written to the repository
  payloadSaved?: boolean // true once extraction_payloads confirms the save — only then is it safe to drop result/raw_text from localStorage
  sourceFilename?: string // the real extraction_payloads/ETL identity for this file — see getSourceFilename()
}

interface StatusResponse {
  status: string
  stage: string
  progress: number
  result?: ExtractionJSON
  error?: string
  raw_text?: string
}

interface OverwriteConflict {
  afe_number: string
  last_updated: string
  resolved_dlq_count: number
}
interface EtlDocumentError {
  source_filename: string
  status: number | null
  message: string
}
interface ExcludedDocument {
  source_filename: string
  reason: string
}
// Matches server/api/afe/import.post.ts's actual return shape for both its
// 'needs_confirmation' and 'imported' responses (fields from either are
// optional here since a single call only ever returns one or the other).
interface ImportResult {
  status: 'needs_confirmation' | 'imported'
  overwrite_conflicts?: OverwriteConflict[]
  new_afe_count?: number
  afe_count?: number
  afe_numbers?: string[]
  etl_errors?: EtlDocumentError[]
  excluded_documents?: ExcludedDocument[]
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

  /* ── Duplicate AFE detection ────────────────────────────
     Warns (does not block) when two or more files in the queue extracted to
     the same AFE number — e.g. the same PDF accidentally uploaded twice, or
     two different documents that happen to reference the same AFE. */
  const duplicateAfeMap = computed(() => {
    const map: Record<string, string[]> = {}
    for (const f of files.value) {
      const afe = f.result?.AFE_Extraction?.AFE_Number?.value
      if (!afe || typeof afe !== 'string') continue
      if (!map[afe]) map[afe] = []
      map[afe].push(f.name)
    }
    return Object.fromEntries(Object.entries(map).filter(([, names]) => names.length > 1))
  })

  function getDuplicateWarning(f: QueuedFile): string | null {
    const afe = f.result?.AFE_Extraction?.AFE_Number?.value
    if (!afe || typeof afe !== 'string') return null
    const group = duplicateAfeMap.value[afe]
    if (!group) return null
    const others = group.filter(name => name !== f.name)
    return `Same AFE number (${afe}) as: ${others.join(', ')}`
  }

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
    // Once a file's payload is confirmed saved server-side (payloadSaved,
    // set only after autoSaveExtractionPayload's network call actually
    // succeeds — not just status === 'done', which can be true slightly
    // before that confirmation lands), there's no need to also duplicate
    // the full extracted JSON into localStorage — hydrateFromDatabase()
    // reconstructs it from extraction_payloads on next load. Anything not
    // yet confirmed saved (still processing, queued, errored, or the save
    // itself failed) has no server-side copy at all, so its full data must
    // stay in localStorage or it's lost entirely.
    const clearBlobs = newVal.map(({ file, pollIntervalId, result, raw_text, ...rest }) =>
      rest.payloadSaved ? rest : { ...rest, result, raw_text }
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clearBlobs))
  }, { deep: true })

  interface PayloadApiRow {
    source_filename: string
    afe_number: string | null
    payload: ExtractionJSON
    saved_at: string
    imported: boolean
  }

  /**
   * Pulls in extraction_payloads rows from the server that aren't already
   * present in the local queue (localStorage only remembers this browser's
   * last 3 hours — this table remembers everything, forever, regardless of
   * browser or session). Without this, a document extracted earlier, or on
   * another device, is invisible here even though it's sitting in the
   * database the whole time.
   */
  // Same definition already used in pollStatus to gate the original
  // auto-save — reused here so a hydrated row is judged by the identical
  // rule, rather than inventing a second definition of "looks legitimate."
  function hasValidExtraction(result: ExtractionJSON | null | undefined): boolean {
    const afeNumber = result?.AFE_Extraction?.AFE_Number?.value
    return typeof afeNumber === 'string' && afeNumber.trim() !== ''
  }

  async function hydrateFromDatabase() {
    let rows: PayloadApiRow[]
    try {
      rows = await $fetch<PayloadApiRow[]>('/api/extract/payloads')
    } catch (e) {
      console.warn('Failed to load extraction payloads from database:', e)
      return
    }

    for (const row of rows) {
      const existingIndex = files.value.findIndex(f => getSourceFilename(f) === row.source_filename)
      const isValid = hasValidExtraction(row.payload)

      if (existingIndex !== -1) {
        const existing = files.value[existingIndex]
        // "imported" can change from another session/browser at any time,
        // so refresh it regardless of whether this entry's payload was
        // ever stripped locally.
        existing.imported = row.imported
        if (!existing.result) {
          // Was restored from localStorage with its payload stripped
          // (payloadSaved was true, so result/raw_text weren't persisted)
          // — fill the gap back in from the database instead of re-adding
          // a duplicate entry.
          existing.result = row.payload
          existing.payloadSaved = true
          if (!isValid) {
            existing.status = 'error'
            existing.error = 'This extraction has no usable data (no AFE Number found) — it should not have been marked Done.'
          }
        }
        continue
      }

      const savedMs = new Date(row.saved_at.replace(' ', 'T') + 'Z').getTime()
      files.value.push({
        id: crypto.randomUUID(),
        name: row.source_filename,
        sourceFilename: row.source_filename,
        size: 0,
        // A row can exist here with no usable data despite our own gates —
        // e.g. an older row saved before this check existed, or one saved
        // via a different path that didn't apply the same gate. Whatever
        // the cause, surface it as an error here rather than showing a
        // green "Done" pill for something with nothing in it.
        status: isValid ? 'done' : 'error',
        progress: 100,
        stage: '',
        result: row.payload,
        error: isValid ? '' : 'This extraction has no usable data (no AFE Number found) — it should not have been marked Done.',
        showRaw: false,
        timestamp: Number.isFinite(savedMs) ? savedMs : Date.now(),
        imported: row.imported,
        payloadSaved: true,
      })
    }
  }

  /* ── File handling ─────────────────────────────────────*/
  function addFiles(list: File[]) {
    for (const file of list) {
      if (file.type !== 'application/pdf') continue

      // Identity here is purely filename-based (saveExtractionPayload
      // upserts by source_filename), so a different file that happens to
      // share a name would otherwise silently overwrite the older one's
      // saved extraction the moment this one finishes processing, with no
      // warning at all. hydrateFromDatabase() already keeps the queue in
      // sync with everything ever saved, so checking against it here is a
      // complete check, not just "duplicates within this upload batch."
      const prospectiveSourceFilename = file.name.replace(/\.pdf$/i, '') + '_extracted.json'
      const collision = files.value.find(f => getSourceFilename(f) === prospectiveSourceFilename)
      if (collision) {
        const proceed = confirm(
          `"${collision.name}" is already in your queue and maps to the same saved identity ` +
          `(${prospectiveSourceFilename}). Processing this file will overwrite its saved extraction ` +
          `data once done. Continue anyway?`
        )
        if (!proceed) continue
      }

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
  // Removing a queue item never touches the database on its own — the queue
  // is just this session's working list, not the repository. But if this
  // Every successfully-extracted file with a valid AFE Number gets
  // auto-saved to extraction_payloads the moment it finishes (see
  // autoSaveExtractionPayload/pollStatus) — that happens regardless of
  // whether it's ever imported. So removing a queue item should clean up
  // that raw-payload row too, or it'd just pile up an orphaned entry for
  // every file ever extracted and later dismissed. This is deliberately NOT
  // the same as deleting a real AFE record — the repository tables
  // (afe_records/raw_data/issue_data) are never touched here; deleting an
  // actual AFE record is a separate action that lives on the Repository
  // page (server/api/afe/delete.post.ts), not the queue.
  async function removeFile(id: string) {
    const f = files.value.find(x => x.id === id)
    // payloadSaved (not f.result) is the right signal here: it's set
    // whenever this file actually has a row in extraction_payloads — either
    // from a fresh successful extraction, or from hydrateFromDatabase() on
    // load — regardless of whether f.result itself is currently populated
    // in memory. Checking f.result directly was the bug: if it's ever
    // falsy for any reason, the delete call got silently skipped and only
    // the local queue item disappeared, leaving the database row behind.
    if (f?.payloadSaved) {
      // Two different local files can share the same identity
      // (source_filename is derived from the name, and extraction_payloads
      // is keyed on it) — if another queue entry besides this one still
      // maps to that same identity, deleting the shared row here would
      // silently wipe out its only backup too, even though it still looks
      // fine on screen right now. Only actually delete once this is the
      // last local entry relying on it.
      const sourceFilename = getSourceFilename(f)
      const hasSibling = files.value.some(other => other.id !== id && getSourceFilename(other) === sourceFilename)

      if (!hasSibling) {
        try {
          await $fetch('/api/extract/delete-payload', {
            method: 'POST',
            body: { source_filename: sourceFilename },
          })
        } catch (err) {
          // Best-effort cleanup of an audit row — don't block removing the
          // file from the queue just because this failed.
          console.warn('Failed to delete extraction payload:', err)
        }
      }
    }
    files.value = files.value.filter(x => x.id !== id)
  }
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

          // A document with no AFE Number can't be reliably tracked once it
          // reaches the repository — there's nothing to key its records on,
          // and multiple such files become indistinguishable from each
          // other downstream. Treat this as a failure here, at the source,
          // rather than letting it reach the database as an untraceable
          // orphan: the file is excluded from import automatically since
          // importToRepository() only sends files with status === 'done'.
          const hasAfeNumber = hasValidExtraction(f.result)

          if (!hasAfeNumber) {
            f.status = 'error'
            f.error = 'Extraction completed, but no AFE Number was found in this document. Without one, this file can\'t be tracked in the repository — check the source PDF and try re-extracting.'
          } else {
            // Preserve the raw extraction the moment it succeeds — independent
            // of "Import to Repository" entirely. Import stays a deliberate
            // click (it calls the ETL API and can overwrite repository data),
            // but this is just a safety copy so a successful extraction is
            // never lost to the 3-hour localStorage expiry if the user hasn't
            // imported yet. Only reached when there IS an AFE Number — a file
            // that's about to be marked as an error never gets written here
            // at all, since there's no point saving something that's just
            // going to be deleted again on removal.
            await autoSaveExtractionPayload(f)

            // A fresh extraction has no idea whether this exact AFE was
            // already imported in a previous session — that check only ran
            // once, at page load, in hydrateFromDatabase(). Re-running it
            // here picks that up for this file (and refreshes everyone
            // else's status too, which is harmless — it's just a read).
            await hydrateFromDatabase()
          }
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
  const importing = ref(false)
  const importingFileId = ref<string | null>(null) // set only when a single row's button triggered this, not "Import All"
  const importError = ref<string | null>(null)

  // The one place a file's real extraction_payloads identity gets resolved.
  // For a freshly-extracted file, f.name is still the original PDF name, so
  // it's derived and cached here on first use. For a hydrated file (from
  // hydrateFromDatabase()), sourceFilename is already set directly from the
  // database row — critical, because f.name for those is ALREADY the final
  // "..._extracted.json" form; re-running the PDF-suffix derivation on it
  // would incorrectly double the suffix (that was the actual delete bug).
  function getSourceFilename(f: QueuedFile): string {
    if (!f.sourceFilename) {
      f.sourceFilename = f.name.replace(/\.pdf$/i, '') + '_extracted.json'
    }
    return f.sourceFilename
  }

  function buildDocument(f: QueuedFile) {
    return {
      source_filename: getSourceFilename(f),
      payload: f.result,
    }
  }

  // Fire-and-forget-ish: best effort, doesn't disrupt the extraction UX if
  // it fails (e.g. the server briefly unreachable) — the result still lives
  // in this file's in-memory/localStorage state as a fallback either way.
  async function autoSaveExtractionPayload(f: QueuedFile) {
    if (!f.result) return
    try {
      const doc = buildDocument(f)
      await $fetch('/api/extract/save-payload', {
        method: 'POST',
        body: doc,
      })
      f.payloadSaved = true // only set once the server has actually confirmed it — see the localStorage watcher below
    } catch (e) {
      console.warn('Failed to auto-save extraction payload:', e)
    }
  }

  // Shared by both "Import All" and a single row's "Import to Repository"
  // button — same two-phase confirm flow and error surfacing either way,
  // just a different-sized `documents` array going in. Returns the
  // source_filenames that actually made it into the repository, so callers
  // can mark those specific files as imported.
  async function runImportFlow(documents: Array<{ source_filename: string; payload: unknown }>): Promise<string[]> {
    // Phase 1: check for existing-AFE conflicts, doesn't write yet
    const result = await $fetch<ImportResult>('/api/afe/import', {
      method: 'POST',
      body: { documents },
    })

    if (result.status === 'needs_confirmation') {
      const conflicts = result.overwrite_conflicts ?? []
      const names = conflicts.map(c => c.afe_number).join(', ')
      const withFixes = conflicts.filter(c => c.resolved_dlq_count > 0)

      let message = `${conflicts.length} AFE record(s) already exist and will be overwritten: ${names}.`
      if (withFixes.length > 0) {
        message += `\n\nWarning: ${withFixes.length} of these have manually resolved DLQ flags that may be lost if the new data still has the same issues.`
      }
      message += '\n\nContinue and overwrite?'

      if (!confirm(message)) return [] // user declined — nothing was written

      // Phase 2: confirmed — write for real
      await $fetch('/api/afe/import', {
        method: 'POST',
        body: { confirmOverwrite: true, documents },
      })
    }

    // The ETL API processes documents independently — one failing (bad
    // payload, ETL exception, or the API being down) doesn't block the
    // rest, but the user should still know something didn't make it in.
    const messages: string[] = []
    const failedFilenames = new Set<string>()
    if (result.etl_errors && result.etl_errors.length > 0) {
      const names = result.etl_errors.map(e => e.source_filename)
      names.forEach(n => failedFilenames.add(n))
      messages.push(`${result.etl_errors.length} document(s) failed ETL processing and were skipped: ${names.join(', ')}`)
    }
    if (result.excluded_documents && result.excluded_documents.length > 0) {
      const names = result.excluded_documents.map(e => e.source_filename)
      names.forEach(n => failedFilenames.add(n))
      messages.push(`${result.excluded_documents.length} document(s) had no AFE Number and were not imported: ${names.join(', ')}`)
    }
    if (messages.length > 0) importError.value = messages.join('\n\n')

    return documents.map(d => d.source_filename).filter(name => !failedFilenames.has(name))
  }

  // "Import All" — every successfully-extracted file in the queue at once.
  async function importToRepository() {
    importing.value = true
    importingFileId.value = null
    importError.value = null
    try {
      const eligible = files.value.filter(f => f.status === 'done' && f.result)

      if (eligible.length === 0) {
        importError.value = 'No successfully extracted documents to import.'
        return
      }

      const importedFilenames = await runImportFlow(eligible.map(buildDocument))
      for (const f of eligible) {
        f.imported = importedFilenames.includes(buildDocument(f).source_filename)
      }
      if (importedFilenames.length > 0) {
        alert(`Import complete: ${importedFilenames.length} document${importedFilenames.length !== 1 ? 's' : ''} successfully imported to the repository.`)
      }
    } catch (err: any) {
      importError.value = err?.data?.statusMessage ?? err.message
    } finally {
      importing.value = false
      importingFileId.value = null
    }
  }

  // Import a single file's extraction result on its own, from its row in the queue.
  async function importOne(f: QueuedFile) {
    if (f.status !== 'done' || !f.result) return

    importing.value = true
    importingFileId.value = f.id
    importError.value = null
    try {
      const doc = buildDocument(f)
      const importedFilenames = await runImportFlow([doc])
      f.imported = importedFilenames.includes(doc.source_filename)
      if (importedFilenames.length > 0) {
        alert(`"${f.name}" was successfully imported to the repository.`)
      }
    } catch (err: any) {
      importError.value = err?.data?.statusMessage ?? err.message
    } finally {
      importing.value = false
      importingFileId.value = null
    }
  }

  return {
    files, isBusy, doneCount, allDone,
    duplicateAfeMap, getDuplicateWarning,
    restoreQueue, hydrateFromDatabase, addFiles, removeFile, clearAll,
    runOne, runAll, pollStatus, cancelExtraction,
    downloadOne, downloadAll, pretty, formatBytes, statusLabel,
    importToRepository, importOne, importing, importingFileId, importError,
  }
})
