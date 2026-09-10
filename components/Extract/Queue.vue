<template>
  <section v-if="store.files.length" class="card queue-card">
    <div class="card-head">
      <div>
        <span class="section-label">Queue</span>
        <h2 class="card-title">{{ store.files.length }} file{{ store.files.length > 1 ? 's' : '' }}</h2>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost" @click="store.clearAll()" :disabled="store.isBusy">
          <Icon name="heroicons:trash" class="btn-ic" /> Clear
        </button>
        <button class="btn btn-primary" @click="store.runAll()" :disabled="store.isBusy || store.allDone">
          <Icon name="heroicons:bolt" class="btn-ic" />
          {{ store.isBusy ? 'Extracting…' : 'Extract all' }}
        </button>
      </div>
    </div>

    <ul class="file-list">
      <li v-for="f in store.files" :key="f.id" class="file-row">
        <div class="file-main">
          <Icon name="heroicons:document-text" class="file-ic" />
          <div class="file-meta">
            <span class="file-name">{{ f.name }}</span>
            <span class="file-size">{{ store.formatBytes(f.size) }}</span>
          </div>
          <span class="status" :class="'status--' + f.status">
            <span class="dot"></span>{{ store.statusLabel(f.status) }}
          </span>

          <div class="row-actions">
            <button
              v-if="f.status === 'done'"
              class="icon-btn"
              title="Download JSON"
              @click="store.downloadOne(f)"
            >
              <Icon name="heroicons:arrow-down-tray" />
            </button>

            <button
              v-if="f.status === 'processing'"
              class="icon-btn stop-btn"
              title="Force Cancel"
              @click="store.cancelExtraction(f)"
            >
              <Icon name="heroicons:stop-circle" />
            </button>

            <button
              v-if="f.status !== 'processing'"
              class="icon-btn"
              title="Remove"
              @click="store.removeFile(f.id)"
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

        <p v-if="f.status === 'done' && store.getDuplicateWarning(f)" class="warn-msg">
          <Icon name="heroicons:exclamation-triangle" class="warn-ic" />
          {{ store.getDuplicateWarning(f) }}
        </p>

        <div v-if="f.status === 'done' && (f.result || f.raw_text)" class="result">
          <ExtractExtractionResult v-if="f.result" :data="f.result" />

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

          <pre v-if="f.showRaw" class="raw-json">{{ f.result ? store.pretty(f.result) : f.raw_text }}</pre>
        </div>
      </li>
    </ul>

    <div v-if="store.doneCount > 0" class="footer-actions">
      <button class="btn btn-ghost" @click="store.downloadAll()">
        <Icon name="heroicons:archive-box-arrow-down" class="btn-ic" />
        Download all JSON
      </button>
      <button class="btn btn-ghost" @click="store.importToRepository()" :disabled="store.importing">
        <Icon name="heroicons:cloud-arrow-up" />
        {{ store.importing ? 'Importing...' : 'Import to Repository' }}
      </button>
    </div>
    <p v-if="store.importError" class="err-msg" style="justify-content: flex-end; margin-top: 8px;">
      <Icon name="heroicons:exclamation-triangle" class="err-ic" /> {{ store.importError }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { useExtractStore } from '~/stores/extractStore'

const store = useExtractStore()
</script>

<style scoped>
.card {
  position: relative;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.03);
  padding: 28px;
  margin-bottom: 24px;
  overflow: hidden;
}

.card-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; }
.section-label {
  font-family: 'Inter'; font-size: 10px; font-weight: 700; letter-spacing: .8px;
  text-transform: uppercase; color: #94a3b8;
}
.card-title { font-family: 'Poppins'; font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
.head-actions { display: flex; gap: 10px; }

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

.file-list { list-style: none; display: flex; flex-direction: column; gap: 14px; }
.file-row { border: 1px solid #f1f5f9; border-radius: 16px; padding: 14px 16px; background: #fcfcfd; }
.file-main { display: flex; align-items: center; gap: 12px; }
.file-ic { width: 22px; height: 22px; color: #fb923c; flex-shrink: 0; }
.file-meta { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.file-name { font-weight: 600; font-size: 14px; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-size { font-family: 'Inter'; font-size: 11.5px; color: #94a3b8; }

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

.progress { height: 6px; background: #f1f5f9; border-radius: 99px; margin-top: 14px; overflow: hidden; }
.progress-bar { height: 100%; background: var(--platform); border-radius: 99px; transition: width .4s ease; }
.progress-stage { font-family: 'Inter'; font-size: 11.5px; color: #94a3b8; margin-top: 6px; }
.err-msg { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #b91c1c; margin-top: 12px; }
.err-ic { width: 15px; height: 15px; }
.warn-msg { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #b45309; margin-top: 8px; }
.warn-ic { width: 15px; height: 15px; }

.result { margin-top: 16px; padding-top: 16px; border-top: 1px solid #f1f5f9; }

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
</style>
