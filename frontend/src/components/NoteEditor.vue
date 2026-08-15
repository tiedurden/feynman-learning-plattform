<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Page, TextBox } from '@/types'
import { useNotesStore } from '@/stores/notesStore'
import TextBoxItem from './TextBoxItem.vue'
import LinkContextMenu from './LinkContextMenu.vue'
import type { MenuItem } from './LinkContextMenu.vue'
import ReferenceModal from './ReferenceModal.vue'
import RefTooltip from './RefTooltip.vue'

const props = defineProps<{
  page?: Page
}>()

const emit = defineEmits<{
  (e: 'update', patch: Partial<Pick<Page, 'title'>>): void
  (e: 'navigate', targetPageId: string): void
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

// --- Reference (link) creation / editing ------------------------------------
interface PendingLink {
  boxId: string
  start: number
  end: number
  text: string
}

const contextMenu = ref<{ x: number; y: number; items: MenuItem[] } | null>(null)
const modalOpen = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const modalInitialText = ref('')
const modalInitialTarget = ref<string | undefined>(undefined)
/** Set while creating a brand-new link. */
const pendingLink = ref<PendingLink | null>(null)
/** Set while editing an existing link. */
const editingRef = ref<{ boxId: string; referenceId: string } | null>(null)

const notebookTrees = computed(() => store.allNotebookTrees)

function closeMenu() {
  contextMenu.value = null
}

/** Right-clicked a text selection → offer "Create link". */
function onRequestLink(
  box: TextBox,
  payload: { start: number; end: number; x: number; y: number }
) {
  const pending: PendingLink = {
    boxId: box.id,
    start: payload.start,
    end: payload.end,
    text: box.text.slice(payload.start, payload.end)
  }
  contextMenu.value = {
    x: payload.x,
    y: payload.y,
    items: [{ label: '🔗 Create link…', action: () => startCreate(pending) }]
  }
}

/** Right-clicked an existing link → offer "Edit" / "Remove". */
function onRequestLinkMenu(
  box: TextBox,
  payload: { referenceId: string; x: number; y: number }
) {
  const ref = box.references?.find((r) => r.id === payload.referenceId)
  if (!ref) return
  const currentText = box.text.slice(ref.start, ref.end)
  const targetPageId = ref.targetPageId
  contextMenu.value = {
    x: payload.x,
    y: payload.y,
    items: [
      {
        label: '✏️ Edit link…',
        action: () => startEdit(box.id, ref.id, currentText, targetPageId)
      },
      {
        label: '🗑 Remove link',
        danger: true,
        action: () => removeLink(box.id, ref.id)
      }
    ]
  }
}

function startCreate(pending: PendingLink) {
  pendingLink.value = pending
  editingRef.value = null
  modalMode.value = 'create'
  modalInitialText.value = pending.text
  modalInitialTarget.value = undefined
  contextMenu.value = null
  modalOpen.value = true
}

function startEdit(
  boxId: string,
  referenceId: string,
  currentText: string,
  targetPageId: string
) {
  editingRef.value = { boxId, referenceId }
  pendingLink.value = null
  modalMode.value = 'edit'
  modalInitialText.value = currentText
  modalInitialTarget.value = targetPageId
  contextMenu.value = null
  modalOpen.value = true
}

function removeLink(boxId: string, referenceId: string) {
  if (props.page) store.removeBoxReference(props.page.id, boxId, referenceId)
  contextMenu.value = null
}

function onModalConfirm(payload: { linkText: string; targetPageId: string }) {
  if (props.page) {
    if (modalMode.value === 'create' && pendingLink.value) {
      store.addBoxReference(props.page.id, pendingLink.value.boxId, {
        start: pendingLink.value.start,
        end: pendingLink.value.end,
        targetPageId: payload.targetPageId,
        linkText: payload.linkText
      })
    } else if (modalMode.value === 'edit' && editingRef.value) {
      store.updateBoxReference(
        props.page.id,
        editingRef.value.boxId,
        editingRef.value.referenceId,
        { linkText: payload.linkText, targetPageId: payload.targetPageId }
      )
    }
  }
  modalOpen.value = false
  pendingLink.value = null
  editingRef.value = null
}

function onModalCancel() {
  modalOpen.value = false
  pendingLink.value = null
  editingRef.value = null
}

// --- Reference tooltip + navigation -----------------------------------------
const tooltip = ref<{ path: string[]; rect: DOMRect } | null>(null)

function onRefHover(payload: { targetPageId: string; rect: DOMRect }) {
  tooltip.value = { path: store.pagePath(payload.targetPageId), rect: payload.rect }
}
function onRefLeave() {
  tooltip.value = null
}
function onRefClick(targetPageId: string) {
  tooltip.value = null
  emit('navigate', targetPageId)
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
          :references="box.references"
          @update:text="onSavedText(box, $event)"
          @blur="onSavedBlur(box)"
          @drag-start="onDragHandleDown(box, $event)"
          @request-link="onRequestLink(box, $event)"
          @request-link-menu="onRequestLinkMenu(box, $event)"
          @ref-click="onRefClick"
          @ref-hover="onRefHover"
          @ref-leave="onRefLeave"
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

    <!-- Right-click menu: create (on selection) or edit/remove (on a link). -->
    <LinkContextMenu
      v-if="contextMenu"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      @close="closeMenu"
    />

    <!-- Link create/edit modal: edit text + pick a target page. -->
    <ReferenceModal
      :open="modalOpen"
      :mode="modalMode"
      :initial-text="modalInitialText"
      :initial-target-page-id="modalInitialTarget"
      :notebook-trees="notebookTrees"
      @confirm="onModalConfirm"
      @cancel="onModalCancel"
    />

    <!-- Hover tooltip showing the linked page's notebook path. -->
    <RefTooltip :path="tooltip?.path ?? []" :rect="tooltip?.rect ?? null" />
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

