<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Page, TextBox } from '@/types'
import { useNotesStore } from '@/stores/notesStore'
import TextBoxItem from './TextBoxItem.vue'
import FormatMenu from './FormatMenu.vue'
import ReferenceModal from './ReferenceModal.vue'
import RefTooltip from './RefTooltip.vue'
import LinkContextMenu from './LinkContextMenu.vue'

/** Matches LinkContextMenu's item shape (label + optional destructive + action). */
interface LinkMenuItem {
  label: string
  danger?: boolean
  action: () => void
}

const props = defineProps<{
  page?: Page
}>()

const emit = defineEmits<{
  (e: 'update', patch: Partial<Pick<Page, 'title'>>): void
  /** Navigate to another page (Ctrl/Cmd-click on an internal link). */
  (e: 'navigate', pageId: string): void
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

// --- Shared link dialog (external URL + internal page) ----------------------
const linkDialogOpen = ref(false)
const linkDialogText = ref('')
const linkDialogMode = ref<'create' | 'edit'>('create')
const linkInitKind = ref<'web' | 'page'>('page')
const linkInitUrl = ref<string | undefined>(undefined)
const linkInitPageId = ref<string | undefined>(undefined)
/** Selection captured when the dialog opens, restored before insertion. */
let linkRange: Range | null = null

const notebookTrees = computed(() => store.allNotebookTrees)

/** FormatMenu asked to link the current selection — snapshot it, open dialog. */
function onRequestLink(payload: { text: string }) {
  const sel = window.getSelection()
  linkRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null
  linkDialogText.value = payload.text
  linkDialogMode.value = 'create'
  linkInitKind.value = 'page'
  linkInitUrl.value = undefined
  linkInitPageId.value = undefined
  closeFormatMenu()
  linkDialogOpen.value = true
}

function closeLinkDialog() {
  linkDialogOpen.value = false
  linkRange = null
  linkDialogMode.value = 'create'
}

/** Reinstate the saved selection so insertion targets the right editable. */
function restoreLinkRange(): HTMLElement | null {
  if (!linkRange) return null
  const node = linkRange.commonAncestorContainer
  const host = (node instanceof Element ? node : node.parentElement)?.closest(
    '[contenteditable="true"]'
  ) as HTMLElement | null
  host?.focus()
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(linkRange)
  return host
}

/** Build and insert an anchor over the saved range, then persist the change. */
function insertLinkAnchor(anchor: HTMLAnchorElement) {
  const host = restoreLinkRange()
  if (!linkRange) return
  linkRange.deleteContents()
  linkRange.insertNode(anchor)
  // Drop the caret just after the inserted link.
  const after = document.createRange()
  after.setStartAfter(anchor)
  after.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(after)
  // Notify the owning editable so TextBoxItem re-emits sanitized HTML.
  host?.dispatchEvent(new Event('input', { bubbles: true }))
}

function onLinkConfirm(
  payload: { linkText: string; url: string } | { linkText: string; targetPageId: string }
) {
  const anchor = document.createElement('a')
  anchor.textContent = payload.linkText || ('url' in payload ? payload.url : 'link')
  if ('url' in payload) {
    anchor.setAttribute('href', payload.url)
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
  } else {
    anchor.setAttribute('class', 'page-link')
    anchor.setAttribute('data-page-id', payload.targetPageId)
  }
  insertLinkAnchor(anchor)
  closeLinkDialog()
}

// --- Link edit / remove context menu ----------------------------------------
const linkMenu = ref<{ x: number; y: number } | null>(null)
/** The anchor targeted by the currently open link context menu. */
let menuAnchor: HTMLAnchorElement | null = null

const linkMenuItems = computed<LinkMenuItem[]>(() => [
  { label: 'Edit link…', action: editCurrentLink },
  { label: 'Remove link', danger: true, action: removeCurrentLink }
])

/** TextBoxItem right-clicked an existing link — show the edit/remove menu. */
function onRequestLinkMenu(payload: { x: number; y: number; anchor: HTMLAnchorElement }) {
  menuAnchor = payload.anchor
  linkMenu.value = { x: payload.x, y: payload.y }
}

function closeLinkMenu() {
  linkMenu.value = null
  menuAnchor = null
}

/** Open the shared dialog pre-filled from the targeted anchor (edit mode). */
function editCurrentLink() {
  const anchor = menuAnchor
  linkMenu.value = null
  if (!anchor) return
  // A range spanning the whole anchor so confirming replaces it in place.
  const range = document.createRange()
  range.selectNode(anchor)
  linkRange = range
  const pageId = anchor.getAttribute('data-page-id')
  linkDialogText.value = anchor.textContent ?? ''
  linkInitKind.value = pageId ? 'page' : 'web'
  linkInitUrl.value = pageId ? undefined : (anchor.getAttribute('href') ?? undefined)
  linkInitPageId.value = pageId ?? undefined
  linkDialogMode.value = 'edit'
  linkDialogOpen.value = true
  menuAnchor = null
}

/** Unwrap the targeted anchor, leaving its text behind, then persist. */
function removeCurrentLink() {
  const anchor = menuAnchor
  closeLinkMenu()
  if (!anchor) return
  const host = anchor.closest('[contenteditable="true"]') as HTMLElement | null
  const parent = anchor.parentNode
  if (parent) {
    parent.replaceChild(document.createTextNode(anchor.textContent ?? ''), anchor)
  }
  host?.dispatchEvent(new Event('input', { bubbles: true }))
}

// --- Internal-link hover tooltip --------------------------------------------
const tooltip = ref<{ path: string[]; rect: DOMRect } | null>(null)

function onRefHover(payload: { pageId: string; rect: DOMRect } | null) {
  tooltip.value = payload
    ? { path: store.pagePath(payload.pageId), rect: payload.rect }
    : null
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
          @navigate="emit('navigate', $event)"
          @ref-hover="onRefHover"
          @request-link-menu="onRequestLinkMenu"
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
          @navigate="emit('navigate', $event)"
          @ref-hover="onRefHover"
          @request-link-menu="onRequestLinkMenu"
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
      @request-link="onRequestLink"
    />

    <!-- Shared link dialog: external URL or internal page -->
    <ReferenceModal
      :open="linkDialogOpen"
      :initial-text="linkDialogText"
      :initial-kind="linkInitKind"
      :initial-url="linkInitUrl"
      :initial-target-page-id="linkInitPageId"
      :mode="linkDialogMode"
      :notebook-trees="notebookTrees"
      @confirm="onLinkConfirm"
      @cancel="closeLinkDialog"
    />

    <!-- Right-click menu on an existing link: edit / remove -->
    <LinkContextMenu
      v-if="linkMenu"
      :x="linkMenu.x"
      :y="linkMenu.y"
      :items="linkMenuItems"
      @close="closeLinkMenu"
    />

    <!-- Breadcrumb tooltip while hovering an internal page link -->
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

