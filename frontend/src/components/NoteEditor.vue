<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Page, TextBox } from '@/types'
import { useNotesStore } from '@/stores/notesStore'
import TextBoxItem from './TextBoxItem.vue'

const props = defineProps<{
  page?: Page
}>()

const emit = defineEmits<{
  (e: 'update', patch: Partial<Pick<Page, 'title'>>): void
}>()

const store = useNotesStore()

const title = computed({
  get: () => props.page?.title ?? '',
  set: (v: string) => emit('update', { title: v })
})

/** Draft boxes exist only locally until they contain text. */
interface DraftBox extends TextBox {
  draft: true
}

const drafts = ref<DraftBox[]>([])
const canvasRef = ref<HTMLElement | null>(null)

const savedBoxes = computed<TextBox[]>(() => props.page?.boxes ?? [])
const isEmpty = computed(
  () => savedBoxes.value.length === 0 && drafts.value.length === 0
)

function localId(): string {
  return `draft-${Math.random().toString(36).slice(2, 9)}`
}

// Switching pages clears any pending (unsaved) drafts.
watch(
  () => props.page?.id,
  () => {
    drafts.value = []
  }
)

/** Drop every draft that has no (non-whitespace) text — nothing was written. */
function pruneEmptyDrafts() {
  drafts.value = drafts.value.filter((d) => d.text.trim().length > 0)
}

// Clicking empty canvas space spawns a draft text box at the cursor position.
function onCanvasMousedown(e: MouseEvent) {
  if (!props.page) return
  // Ignore clicks that land inside an existing box (or its drag handle).
  if ((e.target as HTMLElement).closest('.box-wrap')) return
  // Prevent the browser's default mousedown focus change; otherwise it would
  // steal focus from the box we are about to create and focus, causing an
  // immediate blur that discards the empty draft.
  e.preventDefault()
  const canvas = e.currentTarget as HTMLElement
  // Any previously created but still-empty box is discarded before adding a new one.
  pruneEmptyDrafts()
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left + canvas.scrollLeft
  const y = e.clientY - rect.top + canvas.scrollTop
  drafts.value.push({ id: localId(), x, y, text: '', draft: true })
}

function onDraftText(draft: DraftBox, value: string) {
  draft.text = value
}

function onDraftBlur(draft: DraftBox) {
  if (props.page && draft.text.trim()) {
    // Promote the draft into a persisted box.
    store.addTextBox(props.page.id, { x: draft.x, y: draft.y, text: draft.text })
  }
  // Either way the local draft goes away (persisted one re-renders from store).
  drafts.value = drafts.value.filter((d) => d.id !== draft.id)
}

function onSavedText(box: TextBox, value: string) {
  if (props.page) {
    store.updateTextBox(props.page.id, box.id, { text: value })
  }
}

function onSavedBlur(box: TextBox) {
  // Emptying an existing box deletes it (OneNote behaviour).
  if (props.page && !box.text.trim()) {
    store.removeTextBox(props.page.id, box.id)
  }
}

// --- Drag to reposition a saved box -----------------------------------------
interface DragState {
  boxId: string
  offsetX: number
  offsetY: number
}
let drag: DragState | null = null

function onDragHandleDown(box: TextBox, e: MouseEvent) {
  e.preventDefault()
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return
  drag = {
    boxId: box.id,
    offsetX: e.clientX - rect.left + (canvasRef.value?.scrollLeft ?? 0) - box.x,
    offsetY: e.clientY - rect.top + (canvasRef.value?.scrollTop ?? 0) - box.y
  }
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragUp)
}

function onDragMove(e: MouseEvent) {
  if (!drag || !props.page || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = Math.max(0, e.clientX - rect.left + canvasRef.value.scrollLeft - drag.offsetX)
  const y = Math.max(0, e.clientY - rect.top + canvasRef.value.scrollTop - drag.offsetY)
  store.updateTextBox(props.page.id, drag.boxId, { x, y })
}

function onDragUp() {
  drag = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragUp)
}
</script>

<template>
  <main class="note-editor">
    <template v-if="page">
      <input
        class="title-input"
        v-model="title"
        placeholder="Untitled Page"
        spellcheck="false"
      />

      <div
        ref="canvasRef"
        class="canvas"
        :class="{ 'is-empty': isEmpty }"
        @mousedown="onCanvasMousedown"
      >
        <p v-if="isEmpty" class="canvas-hint">Click anywhere to start a note…</p>

        <!-- Persisted boxes -->
        <TextBoxItem
          v-for="box in savedBoxes"
          :key="box.id"
          :offset-x-in-pixels="box.x"
          :offset-y-in-pixels="box.y"
          :width-in-pixels="box.width"
          :text="box.text"
          @update:text="onSavedText(box, $event)"
          @blur="onSavedBlur(box)"
          @drag-start="onDragHandleDown(box, $event)"
        />

        <!-- Local drafts (not yet saved) -->
        <TextBoxItem
          v-for="draft in drafts"
          :key="draft.id"
          :offset-x-in-pixels="draft.x"
          :offset-y-in-pixels="draft.y"
          :text="draft.text"
          is-draft
          focus-on-mount
          @update:text="onDraftText(draft, $event)"
          @blur="onDraftBlur(draft)"
        />
      </div>
    </template>

    <div v-else class="placeholder">
      <div class="placeholder-inner">
        <div class="big-icon">📝</div>
        <p>Select a page to start taking notes.</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.note-editor {
  background: var(--editor-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 30px 10px;
}

.title-input {
  font-size: 30px;
  font-weight: 600;
  border: none;
  outline: none;
  color: var(--text);
  padding: 0 0 4px;
  font-family: inherit;
  margin-left: 20px;
}
.title-input::placeholder {
  color: #c8c6c4;
}

.meta {
  color: var(--text-muted);
  font-size: 12px;
  border-bottom: 1px solid var(--sidebar-border);
  padding-bottom: 12px;
  margin-bottom: 16px;
}

/* The free-positioning surface. */
.canvas {
  position: relative;
  flex: 1;
  min-height: 300px;
  overflow: auto;
  cursor: text;
}

.canvas-hint {
  position: absolute;
  top: 8px;
  left: 4px;
  margin: 0;
  color: #c8c6c4;
  font-size: 15px;
  pointer-events: none;
  user-select: none;
}


.placeholder {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--text-muted);
}
.placeholder-inner {
  text-align: center;
}
.big-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style>

