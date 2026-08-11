<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotesStore } from '@/stores/notesStore'
import NotebookList from './NotebookList.vue'
import PageTree from './PageTree.vue'
import NoteEditor from './NoteEditor.vue'

const props = defineProps<{
  id?: string
  pageId?: string
}>()

const store = useNotesStore()
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
</script>

<template>
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
    />
  </div>
</template>

<style scoped>
.app-layout {
  display: grid;
  grid-template-columns: 220px 300px 1fr;
  height: 100%;
  overflow: hidden;
}

@media (max-width: 900px) {
  .app-layout {
    grid-template-columns: 180px 240px 1fr;
  }
}
</style>

