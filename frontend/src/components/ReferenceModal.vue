<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { NotebookTree } from '@/types'
import NotebookTreePicker from './NotebookTreePicker.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    /** The originally marked text (pre-fills the editable input). */
    initialText: string
    notebookTrees: NotebookTree[]
    /** Pre-selected target page (edit mode). */
    initialTargetPageId?: string
    /** 'create' (default) or 'edit' — changes titles/labels only. */
    mode?: 'create' | 'edit'
  }>(),
  { initialTargetPageId: undefined, mode: 'create' }
)

const emit = defineEmits<{
  (e: 'confirm', payload: { linkText: string; targetPageId: string }): void
  (e: 'cancel'): void
}>()

const linkText = ref(props.initialText)
const selectedPageId = ref<string | undefined>(undefined)
const inputEl = ref<HTMLInputElement | null>(null)

const dialogTitle = computed(() => (props.mode === 'edit' ? 'Edit link' : 'Create link'))
const submitLabel = computed(() => (props.mode === 'edit' ? 'Save link' : 'Create link'))

// Reset local state each time the modal is (re)opened.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      linkText.value = props.initialText
      selectedPageId.value = props.initialTargetPageId
      await Promise.resolve()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  }
)

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') emit('cancel')
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

function confirm() {
  if (!selectedPageId.value || !linkText.value.trim()) return
  emit('confirm', { linkText: linkText.value, targetPageId: selectedPageId.value })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="overlay"
        role="dialog"
        aria-modal="true"
        @click.self="emit('cancel')"
      >
        <div class="dialog">
          <h2 class="dialog-title">{{ dialogTitle }}</h2>

          <label class="field">
            <span class="field-label">Link text</span>
            <input
              ref="inputEl"
              v-model="linkText"
              class="text-input"
              type="text"
              spellcheck="false"
              placeholder="Link text"
            />
          </label>

          <div class="field">
            <span class="field-label">Link to page</span>
            <NotebookTreePicker
              :notebook-trees="notebookTrees"
              :selected-page-id="selectedPageId"
              @select="(id) => (selectedPageId = id)"
            />
          </div>

          <div class="dialog-actions">
            <button class="btn" @click="emit('cancel')">Cancel</button>
            <button
              class="btn btn-primary"
              :disabled="!selectedPageId || !linkText.trim()"
              @click="confirm"
            >
              {{ submitLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  z-index: 1000;
}
.dialog {
  background: var(--editor-bg, #fff);
  color: var(--text, #201f1e);
  width: min(460px, calc(100vw - 32px));
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  padding: 20px 22px 18px;
}
.dialog-title {
  margin: 0 0 14px;
  font-size: 17px;
  font-weight: 600;
}
.field {
  display: block;
  margin-bottom: 14px;
}
.field-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #605e5c);
  margin-bottom: 6px;
}
.text-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--sidebar-border, #e1dfdd);
  border-radius: 4px;
  padding: 8px 10px;
  font: inherit;
  font-size: 14px;
  color: var(--text, #201f1e);
  outline: none;
}
.text-input:focus {
  border-color: var(--accent, #7719aa);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.btn {
  border: 1px solid var(--sidebar-border, #e1dfdd);
  background: var(--editor-bg, #fff);
  color: var(--text, #201f1e);
  border-radius: 4px;
  padding: 7px 16px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.btn:hover {
  background: var(--hover, #f3f2f1);
}
.btn-primary {
  background: var(--accent, #7719aa);
  border-color: var(--accent, #7719aa);
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

