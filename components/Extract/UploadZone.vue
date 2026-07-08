<template>
  <section class="card upload-card">
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useExtractStore } from '~/stores/extractStore'

const store = useExtractStore()
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)

function onSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) store.addFiles(Array.from(input.files))
  input.value = ''
}
function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files) store.addFiles(Array.from(e.dataTransfer.files))
}
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
</style>
