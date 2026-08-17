<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Page, TextBox } from '@/types'
import { useNotesStore } from '@/stores/notesStore'
import TextBoxItem from './TextBoxItem.vue'
import FormatMenu from './FormatMenu.vue'

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

/**
 * A rich-text box counts as "blank" when it has no visible text and no
 * embedded widgets (tick boxes / images). Empty markup such as `<br>` or
 * `<div></div>` left behind by the editor should still be treated as empty.
 */
function isBlank(html: string): boolean {
  const tmp = document.createElement('div')
  tmp.innerHTML = html ?? ''
  const hasWidgets = tmp.querySelector('input, img') !== null
  return !hasWidgets && (tmp.textContent ?? '').trim().length === 0
}

// --- Right-click formatting menu --------------------------------------------
const formatMenu = ref<{ x: number; y: number } | null>(null)

function openFormatMenu(e: MouseEvent) {
  // Only offer formatting tools when the click originated inside a text box.
  if (!(e.target as HTMLElement).closest('.box-wrap')) return
  e.preventDefault()
  formatMenu.value = { x: e.clientX, y: e.clientY }
  window.addEventListener('mousedown', onOutsideMenuClick, true)
}

function closeFormatMenu() {
  formatMenu.value = null
  window.removeEventListener('mousedown', onOutsideMenuClick, true)
}

function onOutsideMenuClick(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.format-menu')) closeFormatMenu()
}

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onOutsideMenuClick, true)
})

// Switching pages clears any pending (unsaved) drafts.
watch(
  () => props.page?.id,
  () => {
    drafts.value = []
  }
)

/** Drop every draft that has no visible content — nothing was written. */
function pruneEmptyDrafts() {
  drafts.value = drafts.value.filter((d) => !isBlank(d.text))
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
  if (props.page && !isBlank(draft.text)) {
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
  if (props.page && isBlank(box.text)) {
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
      <div class="meta">Click anywhere below to add a text box</div>

      <div
        ref="canvasRef"
        class="canvas"
        :class="{ 'is-empty': isEmpty }"
        @mousedown="onCanvasMousedown"
        @contextmenu="openFormatMenu"
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
          @request-format="openFormatMenu"
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
          @request-format="openFormatMenu"
        />
      </div>
    </template>

    <div v-else class="placeholder">
      <div class="placeholder-inner">
        <div class="big-icon">📝</div>
        <p>Select a page to start taking notes.</p>
      </div>
    </div>

    <!-- Right-click formatting tools -->
    <FormatMenu
      v-if="formatMenu"
      :x="formatMenu.x"
      :y="formatMenu.y"
      @close="closeFormatMenu"
    />
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

