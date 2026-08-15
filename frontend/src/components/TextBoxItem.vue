<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { TextReference } from '@/types'

const props = defineProps<{
  offsetXInPixels: number
  offsetYInPixels: number
  text: string
  widthInPixels?: number
  isDraft?: boolean
  focusOnMount?: boolean
  references?: TextReference[]
}>()

const emit = defineEmits<{
  (e: 'update:text', value: string): void
  (e: 'blur'): void
  (e: 'drag-start', event: MouseEvent): void
  (e: 'request-link', payload: { start: number; end: number; x: number; y: number }): void
  (e: 'request-link-menu', payload: { referenceId: string; x: number; y: number }): void
  (e: 'ref-click', targetPageId: string): void
  (e: 'ref-hover', payload: { targetPageId: string; rect: DOMRect }): void
  (e: 'ref-leave'): void
}>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)

// Drafts are always editable; saved boxes start in read-only display mode and
// switch to an editable textarea when clicked.
const editing = ref<boolean>(!!props.isDraft)

/**
 * Split the box text into plain + linked segments using the reference offsets.
 * Overlapping/out-of-bounds refs are skipped defensively.
 */
interface Segment {
  text: string
  targetPageId?: string
  referenceId?: string
}
const segments = computed<Segment[]>(() => {
  const refs = (props.references ?? [])
    .filter((r) => r.start >= 0 && r.end <= props.text.length && r.start < r.end)
    .slice()
    .sort((a, b) => a.start - b.start)

  const out: Segment[] = []
  let cursor = 0
  for (const ref of refs) {
    if (ref.start < cursor) continue // skip overlap
    if (ref.start > cursor) out.push({ text: props.text.slice(cursor, ref.start) })
    out.push({
      text: props.text.slice(ref.start, ref.end),
      targetPageId: ref.targetPageId,
      referenceId: ref.id
    })
    cursor = ref.end
  }
  if (cursor < props.text.length) out.push({ text: props.text.slice(cursor) })
  return out
})

function resizeToFitContent() {
  const el = textareaEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function handleInput(event: Event) {
  emit('update:text', (event.target as HTMLTextAreaElement).value)
  resizeToFitContent()
}

function onTextareaBlur() {
  if (!props.isDraft) editing.value = false
  emit('blur')
}

/** Right-click inside the textarea with an active selection → offer linking. */
function onContextMenu(event: MouseEvent) {
  const el = textareaEl.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  if (start != null && end != null && end > start) {
    event.preventDefault()
    emit('request-link', { start, end, x: event.clientX, y: event.clientY })
  }
}

/** Enter edit mode when the (non-link) display area is clicked. */
function enterEdit() {
  if (props.isDraft) return
  editing.value = true
}

function onLinkClick(targetPageId: string | undefined, event: MouseEvent) {
  if (!targetPageId) return
  event.stopPropagation()
  emit('ref-click', targetPageId)
}

function onLinkEnter(targetPageId: string | undefined, event: MouseEvent) {
  if (!targetPageId) return
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  emit('ref-hover', { targetPageId, rect })
}

/** Right-click an existing link → offer edit / remove. */
function onLinkContextMenu(referenceId: string | undefined, event: MouseEvent) {
  if (!referenceId) return
  event.preventDefault()
  event.stopPropagation()
  emit('request-link-menu', { referenceId, x: event.clientX, y: event.clientY })
}

onMounted(() => {
  if (editing.value) {
    resizeToFitContent()
    if (props.focusOnMount) textareaEl.value?.focus()
  }
})

// Focus + size the textarea whenever we switch into edit mode.
watch(editing, async (isEditing) => {
  if (isEditing) {
    await nextTick()
    resizeToFitContent()
    textareaEl.value?.focus()
  }
})

watch(
  () => props.text,
  () => {
    if (editing.value) resizeToFitContent()
  }
)

defineExpose({
  focus: () => {
    editing.value = true
    nextTick(() => textareaEl.value?.focus())
  }
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

    <!-- Edit mode: raw text in a textarea (selection → context-menu linking). -->
    <textarea
      v-if="editing"
      ref="textareaEl"
      class="text-box"
      :class="{ 'is-draft': isDraft }"
      :value="text"
      rows="1"
      spellcheck="false"
      :placeholder="isDraft ? 'Type here…' : ''"
      @input="handleInput"
      @blur="onTextareaBlur"
      @contextmenu="onContextMenu"
    />

    <!-- Display mode: plain text with inline reference links. -->
    <div v-else class="text-display" @click="enterEdit">
      <template v-for="(seg, i) in segments" :key="i">
        <a
          v-if="seg.targetPageId"
          class="ref-link"
          @click="onLinkClick(seg.targetPageId, $event)"
          @mouseenter="onLinkEnter(seg.targetPageId, $event)"
          @mouseleave="emit('ref-leave')"
          @contextmenu="onLinkContextMenu(seg.referenceId, $event)"
        >{{ seg.text }}</a>
        <span v-else>{{ seg.text }}</span>
      </template>
    </div>
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

/* Display mode mirrors the textarea metrics so switching feels seamless. */
.text-display {
  min-width: 160px;
  max-width: 520px;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
  box-sizing: border-box;
}
.text-display:hover {
  border-color: var(--sidebar-border);
}

.ref-link {
  color: var(--accent, #7719aa);
  text-decoration: underline;
  text-decoration-color: rgba(119, 25, 170, 0.4);
  cursor: pointer;
}
.ref-link:hover {
  text-decoration-color: var(--accent, #7719aa);
  background: rgba(119, 25, 170, 0.08);
  border-radius: 2px;
}
</style>


