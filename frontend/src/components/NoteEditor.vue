<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Page, TextBox } from '@/types'
import { useNotesStore } from '@/stores/notesStore'

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
/** Id of a freshly created draft that should grab focus on mount. */
const pendingFocusId = ref<string | null>(null)

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

/** Ref callback: focus a draft textarea the moment it is inserted. */
function onDraftMounted(el: HTMLTextAreaElement | null, draft: DraftBox) {
  if (el && pendingFocusId.value === draft.id) {
    el.focus()
    pendingFocusId.value = null
  }
  fitBox(el)
}

/** Grow a textarea to fit its content so multi-line boxes never collapse. */
function fitBox(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/** Drop every draft that has no (non-whitespace) text — nothing was written. */
function pruneEmptyDrafts() {
  drafts.value = drafts.value.filter((d) => d.text.trim().length > 0)
}

function autoGrow(e: Event) {
  fitBox(e.target as HTMLTextAreaElement)
}

// Clicking empty canvas space spawns a draft text box at the cursor position.
function onCanvasMousedown(e: MouseEvent) {
  if (!props.page) return
  // Ignore clicks that land inside an existing box (or its drag handle).
  if ((e.target as HTMLElement).closest('.box-wrap')) return
  // Any previously created but still-empty box is discarded before adding a new one.
  pruneEmptyDrafts()
  const rect = canvasRef.value!.getBoundingClientRect()
  const x = e.clientX - rect.left + canvasRef.value!.scrollLeft
  const y = e.clientY - rect.top + canvasRef.value!.scrollTop
  const draft: DraftBox = { id: localId(), x, y, text: '', draft: true }
  pendingFocusId.value = draft.id
  drafts.value.push(draft)
}

function onDraftBlur(draft: DraftBox) {
  const text = draft.text
  if (props.page && text.trim()) {
    // Promote the draft into a persisted box.
    store.addTextBox(props.page.id, { x: draft.x, y: draft.y, text })
  }
  // Either way the local draft goes away (persisted one re-renders from store).
  drafts.value = drafts.value.filter((d) => d.id !== draft.id)
}

function onSavedInput(box: TextBox, e: Event) {
  autoGrow(e)
  if (props.page) {
    store.updateTextBox(props.page.id, box.id, {
      text: (e.target as HTMLTextAreaElement).value
    })
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

// Safety net: a pointer-down anywhere that is NOT inside a text box removes any
// still-empty draft (covers clicks in other panes / outside the canvas). The
// canvas's own handler prunes-then-creates, so this won't kill a brand-new box.
function onDocPointerDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.text-box')) return
  if ((e.target as HTMLElement).closest('.canvas')) return
  pruneEmptyDrafts()
}

// Clicking outside the browser window (losing focus) also discards empty drafts.
function onWindowBlur() {
  pruneEmptyDrafts()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocPointerDown)
  window.addEventListener('blur', onWindowBlur)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocPointerDown)
  window.removeEventListener('blur', onWindowBlur)
})
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
      <div class="meta">Click anywhere below to add a text box</div>

      <div
        ref="canvasRef"
        class="canvas"
        :class="{ 'is-empty': isEmpty }"
        @mousedown="onCanvasMousedown"
      >
        <p v-if="isEmpty" class="canvas-hint">Click anywhere to start a note…</p>

        <!-- Persisted boxes -->
        <div
          v-for="box in savedBoxes"
          :key="box.id"
          class="box-wrap"
          :style="{ left: box.x + 'px', top: box.y + 'px', width: box.width ? box.width + 'px' : undefined }"
        >
          <span
            class="drag-handle"
            title="Drag to move"
            @mousedown="onDragHandleDown(box, $event)"
          >⠿</span>
          <textarea
            class="text-box"
            :ref="(el) => fitBox(el as HTMLTextAreaElement | null)"
            :data-box-id="box.id"
            :value="box.text"
            rows="1"
            spellcheck="false"
            @input="onSavedInput(box, $event)"
            @blur="onSavedBlur(box)"
          />
        </div>

        <!-- Local drafts (not yet saved) -->
        <div
          v-for="draft in drafts"
          :key="draft.id"
          class="box-wrap"
          :style="{ left: draft.x + 'px', top: draft.y + 'px' }"
        >
          <textarea
            class="text-box is-draft"
            :ref="(el) => onDraftMounted(el as HTMLTextAreaElement | null, draft)"
            v-model="draft.text"
            rows="1"
            spellcheck="false"
            placeholder="Type here…"
            @input="autoGrow"
            @blur="onDraftBlur(draft)"
          />
        </div>
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
  padding: 32px 48px;
}

.title-input {
  font-size: 30px;
  font-weight: 600;
  border: none;
  outline: none;
  color: var(--text);
  padding: 0 0 4px;
  font-family: inherit;
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

.box-wrap {
  position: absolute;
  display: flex;
  align-items: flex-start;
}

.drag-handle {
  opacity: 0;
  cursor: grab;
  user-select: none;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.6;
  padding: 4px 2px 0 0;
}
.box-wrap:hover .drag-handle {
  opacity: 1;
}
.drag-handle:active {
  cursor: grabbing;
}

.text-box {
  min-width: 160px;
  max-width: 520px;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: none;
  resize: none;
  overflow: hidden;
  padding: 4px 6px;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text);
  box-sizing: border-box;
}
.text-box:hover {
  border-color: var(--sidebar-border);
}
.text-box:focus {
  border-color: var(--accent, #7719aa);
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}
.text-box::placeholder {
  color: #c8c6c4;
}

/* A brand-new, not-yet-saved box is clearly visible so you know it worked. */
.text-box.is-draft {
  border-color: var(--accent, #7719aa);
  border-style: dashed;
  background: #fff;
  min-height: 32px;
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

