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
      @contextmenu="emit('request-format', $event)"
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


