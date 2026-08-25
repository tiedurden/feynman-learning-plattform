<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { sanitizeBoxHtml } from '@/utils/sanitizeHtml'

const props = defineProps<{
  offsetXInPixels: number
  offsetYInPixels: number
  /** Rich-text HTML content of the box. */
  text: string
  widthInPixels?: number
  isDraft?: boolean
  focusOnMount?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:text', value: string): void
  (e: 'blur'): void
  (e: 'drag-start', event: MouseEvent): void
  (e: 'request-format', event: MouseEvent): void
  /** Ctrl/Cmd-click on an internal page link — carries the target page id. */
  (e: 'navigate', pageId: string): void
  /** Hovering an internal page link (or null when the pointer leaves one). */
  (e: 'ref-hover', payload: { pageId: string; rect: DOMRect } | null): void
  /** Right-click on an existing link — request the edit/remove menu. */
  (e: 'request-link-menu', payload: { x: number; y: number; anchor: HTMLAnchorElement }): void
}>()

const editableEl = ref<HTMLDivElement | null>(null)

/**
 * Restore checkbox `.checked` *properties* from the persisted `checked`
 * attribute. `innerHTML` only carries attributes, so without this a saved,
 * ticked box would render unchecked after a reload.
 */
function restoreCheckboxes(el: HTMLElement) {
  el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    cb.checked = cb.hasAttribute('checked')
  })
}

/**
 * Push the prop HTML into the DOM without clobbering the caret. We only write
 * when the incoming value actually differs from what is rendered, and never
 * while the element is focused (that would reset the user's cursor). Incoming
 * HTML is sanitized defensively before it touches the DOM.
 */
function syncFromProp() {
  const el = editableEl.value
  if (!el) return
  const next = sanitizeBoxHtml(props.text ?? '')
  if (el.innerHTML !== next) el.innerHTML = next
  restoreCheckboxes(el)
}

function emitContent() {
  const el = editableEl.value
  if (!el) return
  emit('update:text', sanitizeBoxHtml(el.innerHTML))
}

function handleInput() {
  emitContent()
}

/**
 * Intercept paste so rich clipboard HTML is sanitized (or dropped to plain
 * text) instead of letting the browser insert arbitrary markup verbatim.
 */
function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  const data = event.clipboardData
  if (!data) return
  const html = data.getData('text/html')
  const clean = html
    ? sanitizeBoxHtml(html)
    : escapePlainText(data.getData('text/plain'))
  document.execCommand('insertHTML', false, clean)
}

/** Escape plain-text so it inserts literally (no accidental markup). */
function escapePlainText(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * Tick boxes are rendered as real checkboxes. Toggling one only flips the DOM
 * `.checked` *property*, which is invisible to `innerHTML`. We mirror it onto
 * the `checked` *attribute* so the state survives persistence, then re-emit.
 */
function handleChange(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement && target.type === 'checkbox') {
    if (target.checked) target.setAttribute('checked', '')
    else target.removeAttribute('checked')
    emitContent()
  }
}

function placeCaretAtEnd() {
  const el = editableEl.value
  if (!el) return
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}

// --- Link interaction -------------------------------------------------------
// TODO: right-click editing/removal of an existing link via LinkContextMenu.

/**
 * Following a link. Internal page links (`a.page-link[data-page-id]`) navigate
 * on a plain click — matching note-app expectations. External anchors require
 * Ctrl/Cmd-click so normal text editing near them isn't hijacked into opening a
 * tab. Any other plain click just places the caret (normal editing).
 */
function handleClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a')
  if (!anchor) return
  // Clicking navigates/opens, so the box may unmount before `pointerout`
  // fires — dismiss any hover tooltip explicitly.
  emit('ref-hover', null)
  const pageId = anchor.getAttribute('data-page-id')
  if (pageId) {
    event.preventDefault()
    emit('navigate', pageId)
    return
  }
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    const href = anchor.getAttribute('href')
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }
}

/** Surface a breadcrumb tooltip while hovering an internal page link. */
function handlePointerOver(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest('a.page-link') as HTMLElement | null
  const pageId = link?.getAttribute('data-page-id')
  if (link && pageId) {
    emit('ref-hover', { pageId, rect: link.getBoundingClientRect() })
  }
}

function handlePointerOut(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest('a.page-link')
  if (link) emit('ref-hover', null)
}

/**
 * Right-clicking a link opens the link edit/remove menu (owned by NoteEditor)
 * instead of the generic formatting menu. Anywhere else keeps the format menu.
 */
function handleContextMenu(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest('a') as HTMLAnchorElement | null
  if (anchor) {
    event.preventDefault()
    event.stopPropagation()
    emit('request-link-menu', { x: event.clientX, y: event.clientY, anchor })
    return
  }
  emit('request-format', event)
}

onMounted(() => {
  syncFromProp()
  if (props.focusOnMount) placeCaretAtEnd()
})

// Reflect external text changes only while the user isn't actively editing.
watch(
  () => props.text,
  () => {
    if (document.activeElement !== editableEl.value) syncFromProp()
  }
)

defineExpose({
  focus: () => editableEl.value?.focus()
})
</script>

<template>
  <div
    class="box-wrap"
    :style="{
      left: offsetXInPixels + 'px',
      top: offsetYInPixels + 'px',
      width: widthInPixels ? widthInPixels + 'px' : undefined
    }"
  >
    <span
      v-if="!isDraft"
      class="drag-handle"
      title="Drag to move"
      @mousedown="emit('drag-start', $event)"
    >⠿</span>
    <div
      ref="editableEl"
      class="text-box"
      :class="{ 'is-draft': isDraft }"
      contenteditable="true"
      spellcheck="false"
      role="textbox"
      :data-placeholder="isDraft ? 'Type here…' : ''"
      @input="handleInput"
      @change="handleChange"
      @paste="handlePaste"
      @blur="emit('blur')"
      @click="handleClick"
      @pointerover="handlePointerOver"
      @pointerout="handlePointerOut"
      @contextmenu="handleContextMenu"
    />
  </div>
</template>

<style scoped>
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
  padding: 4px 6px;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text);
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-word;
}
.text-box:hover {
  border-color: var(--sidebar-border);
}
.text-box:focus {
  border-color: var(--accent, #7719aa);
  background: #fff;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}
/* Placeholder for an empty editable element. */
.text-box:empty::before {
  content: attr(data-placeholder);
  color: #c8c6c4;
  pointer-events: none;
}

/* Tick boxes sit inline with the text. */
.text-box :deep(.tick) {
  display: inline-block;
  vertical-align: middle;
}
.text-box :deep(.tick input) {
  margin: 0 2px 0 0;
  cursor: pointer;
  vertical-align: middle;
}

/* Rich-text block/inline elements produced by the formatting menu. */
.text-box :deep(h1) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 0.2em 0;
}
.text-box :deep(h2) {
  font-size: 1.3em;
  font-weight: 600;
  margin: 0.2em 0;
}
.text-box :deep(h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0.2em 0;
}
.text-box :deep(blockquote) {
  margin: 0.3em 0;
  padding: 0.1em 0 0.1em 0.7em;
  border-left: 3px solid var(--accent, #7719aa);
  color: var(--text-muted, #605e5c);
}
.text-box :deep(code) {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 0.92em;
  background: #f3f2f1;
  border-radius: 3px;
  padding: 0 4px;
}
.text-box :deep(hr) {
  border: none;
  border-top: 1px solid var(--sidebar-border, #e1dfdd);
  margin: 0.5em 0;
}
.text-box :deep(a) {
  color: var(--accent, #7719aa);
  text-decoration: underline;
}
/* Internal page links read differently from external web links. */
.text-box :deep(a.page-link) {
  color: #0f6cbd;
  text-decoration-style: dotted;
  cursor: pointer;
}

/* A brand-new, not-yet-saved box is clearly visible so you know it worked. */
.text-box.is-draft {
  border-color: var(--accent, #7719aa);
  border-style: dashed;
  background: #fff;
  min-height: 32px;
}
</style>

<!--
  Non-scoped so it can reach the browser's ::selection pseudo-element on the
  editable and its descendants. A translucent selection (with inherited text
  colour) lets a freshly applied text/highlight colour show through *while the
  text is still selected*, so formatting looks reactive instead of only
  appearing once the selection clears.
-->
<style>
.text-box::selection,
.text-box *::selection {
  background: rgba(46, 118, 220, 0.25);
  color: inherit;
}
</style>


