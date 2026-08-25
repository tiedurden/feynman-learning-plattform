<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notesStore'
import { useProgressStore } from '@/stores/progressStore'
import NotebookList from './NotebookList.vue'
import PageTree from './PageTree.vue'
import NoteEditor from './NoteEditor.vue'

const props = defineProps<{
  id?: string
  pageId?: string
}>()

const store = useNotesStore()
const progress = useProgressStore()
const route = useRoute()
const router = useRouter()

// Resolve the active notebook: route param → first notebook fallback.
const activeNotebookId = computed<string | undefined>(
  () => props.id ?? store.notebooks[0]?.id
)
const activeNotebook = computed(() =>
  activeNotebookId.value ? store.notebookById(activeNotebookId.value) : undefined
)
const activePageId = computed<string | undefined>(() => props.pageId)
const activePage = computed(() =>
  activePageId.value ? store.pageById(activePageId.value) : undefined
)

const pageTree = computed(() =>
  activeNotebookId.value ? store.pageTree(activeNotebookId.value) : []
)

// If we land on "/" push to the first notebook so a notebook is always active.
watch(
  () => route.fullPath,
  () => {
    if (route.name === 'home' && store.notebooks[0]) {
      router.replace({ name: 'notebook', params: { id: store.notebooks[0].id } })
    }
  },
  { immediate: true }
)

// When a notebook is open but no page is selected, auto-open its first page so
// the editor canvas (click-to-add text boxes) is always available.
watch(
  [activeNotebookId, activePageId, pageTree],
  () => {
    if (activeNotebookId.value && !activePageId.value) {
      const first = pageTree.value[0]
      if (first) {
        router.replace({
          name: 'page',
          params: { id: activeNotebookId.value, pageId: first.id }
        })
      }
    }
  },
  { immediate: true }
)

function selectNotebook(notebookId: string) {
  router.push({ name: 'notebook', params: { id: notebookId } })
}

function selectPage(pageId: string) {
  if (!activeNotebookId.value) return
  router.push({
    name: 'page',
    params: { id: activeNotebookId.value, pageId }
  })
}

function addNotebook() {
  const nb = store.addNotebook()
  selectNotebook(nb.id)
}

function renameNotebook(notebookId: string, title: string) {
  store.renameNotebook(notebookId, title)
}

function deleteNotebook(notebookId: string) {
  const wasActive = activeNotebookId.value === notebookId
  store.deleteNotebook(notebookId)
  if (wasActive) {
    const next = store.notebooks[0]
    if (next) {
      router.replace({ name: 'notebook', params: { id: next.id } })
    } else {
      router.replace({ name: 'home' })
    }
  }
}

function addRootPage() {
  if (!activeNotebookId.value) return
  const page = store.addPage(activeNotebookId.value, null)
  selectPage(page.id)
}

function addChildPage(parentId: string) {
  if (!activeNotebookId.value) return
  const page = store.addPage(activeNotebookId.value, parentId)
  selectPage(page.id)
}

function deletePage(pageId: string) {
  store.deletePage(pageId)
  if (activePageId.value === pageId && activeNotebookId.value) {
    router.replace({ name: 'notebook', params: { id: activeNotebookId.value } })
  }
}

/** Navigate to a referenced page (may live in a different notebook). */
function navigateToPage(targetPageId: string) {
  const target = store.pageById(targetPageId)
  if (!target) return
  router.push({
    name: 'page',
    params: { id: target.notebookId, pageId: target.id }
  })
}

/** Evaluate only the currently active page (no parent/sibling subpages). */
function evaluateActivePage() {
  if (!activeNotebookId.value || !activePageId.value) return
  // Ensure progress badges are visible so the user sees the result.
  store.setShowProgress(true)
  progress.evaluate({ notebookId: activeNotebookId.value, pageId: activePageId.value })
}

/** Evaluate only the currently active notebook. */
function evaluateActiveNotebook() {
  if (!activeNotebookId.value) return
  // Ensure progress badges are visible so the user sees the result.
  store.setShowProgress(true)
  progress.evaluate({ notebookId: activeNotebookId.value })
}

/** Evaluate every notebook in one request. */
function evaluateAll() {
  store.setShowProgress(true)
  progress.evaluate()
}
</script>

<template>
  <div class="app-shell">
    <!-- Top toolbar: Feynman evaluation controls -->
    <header class="toolbar">
      <div class="toolbar-title">
        <span class="brand">🧠 Feynman</span>
        <span v-if="activeNotebook" class="active-nb">{{ activeNotebook.title }}</span>
      </div>

      <div class="toolbar-actions">
        <span v-if="progress.error" class="eval-error" role="alert">
          ⚠️ {{ progress.error }}
        </span>
        <span
          v-else-if="progress.lastEvaluatedAt"
          class="eval-status"
        >
          Evaluated ✓
        </span>

        <button
          class="btn"
          :disabled="progress.loading || !activePage"
          @click="evaluateActivePage"
        >
          <span v-if="progress.loading" class="spinner" aria-hidden="true"></span>
          {{ progress.loading ? 'Evaluating…' : 'Evaluate Page' }}
        </button>

        <button
          class="btn"
          :disabled="progress.loading || !activeNotebook"
          @click="evaluateActiveNotebook"
        >
          <span v-if="progress.loading" class="spinner" aria-hidden="true"></span>
          {{ progress.loading ? 'Evaluating…' : 'Evaluate Notebook' }}
        </button>

        <button
          class="btn btn-secondary"
          :disabled="progress.loading || store.notebooks.length === 0"
          @click="evaluateAll"
        >
          Evaluate All
        </button>
      </div>
    </header>

    <!-- Three-pane workspace -->
    <div class="app-layout">
      <!-- Pane 1: Notebooks -->
      <NotebookList
        :notebooks="store.notebooks"
        :active-id="activeNotebookId"
        @select="selectNotebook"
        @add="addNotebook"
        @rename="renameNotebook"
        @delete="deleteNotebook"
      />

      <!-- Pane 2: Page tree -->
      <PageTree
        :notebook="activeNotebook"
        :tree="pageTree"
        :active-page-id="activePageId"
        @select="selectPage"
        @add-root="addRootPage"
        @add-child="addChildPage"
        @delete="deletePage"
      />

      <!-- Pane 3: Editor -->
      <NoteEditor
        :page="activePage"
        @update="(patch) => activePage && store.updatePage(activePage.id, patch)"
        @navigate="navigateToPage"
      />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  background: var(--sidebar-bg, #faf9f8);
  border-bottom: 1px solid var(--sidebar-border, #e1dfdd);
  flex: 0 0 auto;
}

.toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
}
.brand {
  font-weight: 700;
  color: var(--text, #201f1e);
}
.active-nb {
  color: var(--text-muted, #605e5c);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.eval-error {
  color: #a4262c;
  font-size: 13px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eval-status {
  color: #0a7c42;
  font-size: 13px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  background: #7719aa;
  color: #fff;
  font: inherit;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  background: #660f95;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-secondary {
  background: transparent;
  color: #7719aa;
  border-color: #c8b6d6;
}
.btn-secondary:hover:not(:disabled) {
  background: #f3ecf8;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.app-layout {
  display: grid;
  grid-template-columns: 220px 300px 1fr;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .app-layout {
    grid-template-columns: 180px 240px 1fr;
  }
}
</style>

