<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  offsetXInPixels: number
  offsetYInPixels: number
  text: string
  widthInPixels?: number
  isDraft?: boolean
  focusOnMount?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:text', value: string): void
  (e: 'blur'): void
  (e: 'drag-start', event: MouseEvent): void
}>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)

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

onMounted(() => {
  resizeToFitContent()
  if (props.focusOnMount) textareaEl.value?.focus()
})

watch(() => props.text, resizeToFitContent)

defineExpose({
  focus: () => textareaEl.value?.focus()
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
    <textarea
      ref="textareaEl"
      class="text-box"
      :class="{ 'is-draft': isDraft }"
      :value="text"
      rows="1"
      spellcheck="false"
      :placeholder="isDraft ? 'Type here…' : ''"
      @input="handleInput"
      @blur="emit('blur')"
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
</style>


