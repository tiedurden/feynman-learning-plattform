<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { NotebookTree } from '@/types'
import NotebookTreePicker from './NotebookTreePicker.vue'

/** Which kind of link the dialog is currently authoring. */
type LinkKind = 'web' | 'page'

/** Discriminated confirm payload: an external URL or an internal page id. */
type ConfirmPayload =
  | { linkText: string; url: string }
  | { linkText: string; targetPageId: string }

const props = withDefaults(
  defineProps<{
    open: boolean
    /** The originally marked text (pre-fills the editable input). */
    initialText: string
    notebookTrees: NotebookTree[]
    /** Pre-selected target page (edit mode). */
    initialTargetPageId?: string
    /** Pre-filled URL for web links (edit mode). */
    initialUrl?: string
    /** Which tab to open on first render. */
    initialKind?: LinkKind
    /** 'create' (default) or 'edit' — changes titles/labels only. */
    mode?: 'create' | 'edit'
  }>(),
  {
    initialTargetPageId: undefined,
    initialUrl: undefined,
    initialKind: 'page',
    mode: 'create'
  }
)

const emit = defineEmits<{
  (e: 'confirm', payload: ConfirmPayload): void
  (e: 'cancel'): void
}>()

const linkText = ref(props.initialText)
const linkKind = ref<LinkKind>(props.initialKind)
const url = ref('')
const selectedPageId = ref<string | undefined>(undefined)
const inputEl = ref<HTMLInputElement | null>(null)
const urlEl = ref<HTMLInputElement | null>(null)

const dialogTitle = computed(() => (props.mode === 'edit' ? 'Edit link' : 'Create link'))
const submitLabel = computed(() => (props.mode === 'edit' ? 'Save link' : 'Create link'))

/** Whether the current tab has enough input to confirm. */
const canConfirm = computed(() => {
  if (!linkText.value.trim()) return false
  return linkKind.value === 'web' ? url.value.trim().length > 0 : !!selectedPageId.value
})

// Reset local state each time the modal is (re)opened.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      linkText.value = props.initialText
      linkKind.value = props.initialKind
      url.value = props.initialUrl ?? ''
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

/** Normalise a user-typed URL to a safe absolute form. */
function normalizeUrl(input: string): string {
  const trimmed = input.trim()
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function confirm() {
  if (!canConfirm.value) return
  if (linkKind.value === 'web') {
    emit('confirm', { linkText: linkText.value, url: normalizeUrl(url.value) })
  } else {
    emit('confirm', { linkText: linkText.value, targetPageId: selectedPageId.value! })
  }
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

          <div class="kind-tabs" role="tablist" aria-label="Link type">
            <button
              class="kind-tab"
              :class="{ active: linkKind === 'page' }"
              role="tab"
              :aria-selected="linkKind === 'page'"
              @click="linkKind = 'page'"
            >
              📄 Page
            </button>
            <button
              class="kind-tab"
              :class="{ active: linkKind === 'web' }"
              role="tab"
              :aria-selected="linkKind === 'web'"
              @click="linkKind = 'web'"
            >
              🌐 Web URL
            </button>
          </div>

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

          <label v-if="linkKind === 'web'" class="field">
            <span class="field-label">URL</span>
            <input
              ref="urlEl"
              v-model="url"
              class="text-input"
              type="text"
              spellcheck="false"
              placeholder="https://example.com"
              @keydown.enter.prevent="confirm"
            />
          </label>

          <div v-else class="field">
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
              :disabled="!canConfirm"
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
.kind-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--sidebar-border, #e1dfdd);
}
.kind-tab {
  border: none;
  background: transparent;
  color: var(--text-muted, #605e5c);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.kind-tab:hover {
  color: var(--text, #201f1e);
}
.kind-tab.active {
  color: var(--accent, #7719aa);
  border-bottom-color: var(--accent, #7719aa);
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

