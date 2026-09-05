<script setup lang="ts">
import { ref } from 'vue'
import type { Notebook, PageNode } from '@/types'
import PageTreeItem from './PageTreeItem.vue'
import ToggleSwitch from './ToggleSwitch.vue'

defineProps<{
  notebook?: Notebook
  tree: PageNode[]
  activePageId?: string
  /** True while this notebook's PDF is being uploaded or removed. */
  pdfBusy?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add-root'): void
  (e: 'add-child', parentId: string): void
  (e: 'delete', id: string): void
  (e: 'upload-pdf', file: File): void
  (e: 'remove-pdf'): void
}>()

// --- Progress display toggle ----------------------------------------------
const showProgress = ref(false)

// --- Reference PDF ---------------------------------------------------------
const fileInput = ref<HTMLInputElement | null>(null)

function pickPdf() {
  fileInput.value?.click()
}

function onPdfSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('upload-pdf', file)
  }
  // Reset so selecting the same file again still fires a change event.
  input.value = ''
}
</script>

<template>
  <section class="page-tree">
    <div class="header">
      <span class="header-title">{{ notebook?.title ?? 'No notebook' }}</span>
      <button
        class="icon-btn"
        title="New page"
        :disabled="!notebook"
        @click="emit('add-root')"
      >
        ＋
      </button>
    </div>

    <!-- Reference PDF for this notebook (used as ground truth when evaluating) -->
    <div v-if="notebook" class="pdf-bar">
      <input
        ref="fileInput"
        class="pdf-input"
        type="file"
        accept="application/pdf,.pdf"
        data-testid="pdf-input"
        @change="onPdfSelected"
      />

      <template v-if="notebook.hasPdf">
        <span class="pdf-name" :title="notebook.pdfFileName ?? 'Reference PDF'">
          📄 {{ notebook.pdfFileName ?? 'Reference PDF' }}
        </span>
        <button
          class="pdf-btn"
          title="Replace PDF"
          :disabled="pdfBusy"
          @click="pickPdf"
        >
          Replace
        </button>
        <button
          class="pdf-btn pdf-btn-danger"
          title="Remove PDF"
          :disabled="pdfBusy"
          @click="emit('remove-pdf')"
        >
          Remove
        </button>
      </template>

      <template v-else>
        <span class="pdf-name pdf-name-muted">No reference PDF</span>
        <button
          class="pdf-btn"
          title="Upload a reference PDF (max 10MB)"
          :disabled="pdfBusy"
          @click="pickPdf"
        >
          {{ pdfBusy ? 'Uploading…' : 'Upload PDF' }}
        </button>
      </template>
    </div>

    <div class="tree-scroll">
      <ul v-if="tree.length" class="tree-root">
        <PageTreeItem
          v-for="node in tree"
          :key="node.id"
          :node="node"
          :depth="0"
          :active-page-id="activePageId"
          :show-progress="showProgress"
          @select="(id) => emit('select', id)"
          @add-child="(id) => emit('add-child', id)"
          @delete="(id) => emit('delete', id)"
        />
      </ul>
      <p v-else class="empty">No pages yet. Click ＋ to create one.</p>
    </div>

    <div class="footer">
      <ToggleSwitch v-model="showProgress" label="Show progress" tone="light" />
    </div>
  </section>
</template>

<style scoped>
.page-tree {
  background: var(--pane-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px 10px;
  border-bottom: 1px solid var(--sidebar-border);
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--sidebar-border);
  border-radius: 4px;
  width: 24px;
  height: 24px;
  font-size: 16px;
  line-height: 1;
  display: grid;
  place-items: center;
}
.icon-btn:hover:not(:disabled) {
  background: var(--hover);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pdf-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--sidebar-border);
}

.pdf-input {
  display: none;
}

.pdf-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pdf-name-muted {
  color: var(--text-muted);
}

.pdf-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--sidebar-border);
  border-radius: 4px;
  font: inherit;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
}
.pdf-btn:hover:not(:disabled) {
  background: var(--hover);
}
.pdf-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pdf-btn-danger {
  color: #a4262c;
}

.tree-scroll {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 6px 0;
}

.tree-root {
  list-style: none;
  margin: 0;
  padding: 0;
}

.empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 16px;
  text-align: center;
}

.footer {
  padding: 8px 12px;
  border-top: 1px solid var(--sidebar-border);
}
</style>

