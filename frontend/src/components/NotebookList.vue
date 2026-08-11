<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { Notebook } from '@/types'
import ConfirmDialog from './ConfirmDialog.vue'
import ProgressBadge from './ProgressBadge.vue'
import ToggleSwitch from './ToggleSwitch.vue'
import { getProgress } from '@/utils/progress'

const props = defineProps<{
  notebooks: Notebook[]
  activeId?: string
}>()

// --- Progress display toggle ----------------------------------------------
const showProgress = ref(false)

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add'): void
  (e: 'rename', id: string, title: string): void
  (e: 'delete', id: string): void
}>()

// --- Inline rename state ---------------------------------------------------
const editingId = ref<string | null>(null)
const draftTitle = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

// The rename input lives inside a v-for, so a string template ref would be
// collected into an array. Use a function ref to capture the single element.
// The callback signature must match Vue's VNodeRef (Element | component | null).
function setInputRef(el: Element | ComponentPublicInstance | null) {
  inputEl.value = (el as HTMLInputElement) ?? null
}

async function startRename(nb: Notebook) {
  editingId.value = nb.id
  draftTitle.value = nb.title
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
}

function commitRename(nb: Notebook) {
  if (editingId.value !== nb.id) return
  const next = draftTitle.value.trim()
  // Ignore blank input — keep the previous title.
  if (next && next !== nb.title) emit('rename', nb.id, next)
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}

// --- Delete confirmation state ---------------------------------------------
const pendingDeleteId = ref<string | null>(null)
const pendingDelete = computed(() =>
  props.notebooks.find((n) => n.id === pendingDeleteId.value)
)

function requestDelete(nb: Notebook) {
  pendingDeleteId.value = nb.id
}

function confirmDelete() {
  if (pendingDeleteId.value) emit('delete', pendingDeleteId.value)
  pendingDeleteId.value = null
}

function cancelDelete() {
  pendingDeleteId.value = null
}
</script>

<template>
  <aside class="notebook-list">
    <div class="header">
      <span class="header-title">Notebooks</span>
      <button class="icon-btn" title="New notebook" @click="emit('add')">＋</button>
    </div>

    <ul class="items">
      <li
        v-for="nb in notebooks"
        :key="nb.id"
        class="item"
        :class="{ active: nb.id === activeId }"
        @click="emit('select', nb.id)"
        @dblclick="startRename(nb)"
      >
        <span class="swatch" :style="{ background: nb.color }" />

        <input
          v-if="editingId === nb.id"
          :ref="setInputRef"
          v-model="draftTitle"
          class="rename-input"
          @click.stop
          @keyup.enter="commitRename(nb)"
          @keyup.esc="cancelRename"
          @blur="commitRename(nb)"
        />
        <span v-else class="title">{{ nb.title }}</span>

        <ProgressBadge
          v-if="showProgress && editingId !== nb.id"
          class="progress"
          :value="getProgress(nb.id)"
        />

        <span v-if="editingId !== nb.id" class="actions">
          <button
            class="mini"
            title="Rename notebook"
            @click.stop="startRename(nb)"
          >
            ✏
          </button>
          <button
            class="mini danger"
            title="Delete notebook"
            @click.stop="requestDelete(nb)"
          >
            🗑
          </button>
        </span>
      </li>
    </ul>

    <ConfirmDialog
      :open="pendingDelete != null"
      title="Delete notebook?"
      :message="
        pendingDelete
          ? `“${pendingDelete.title}” and all its pages will be permanently deleted. This can’t be undone.`
          : ''
      "
      confirm-label="Delete"
      cancel-label="Cancel"
      danger
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <div class="footer">
      <ToggleSwitch v-model="showProgress" label="Show progress" tone="dark" />
    </div>
  </aside>
</template>

<style scoped>
.notebook-list {
  background: var(--nb-purple);
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px 8px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.header-title {
  font-size: 13px;
  text-transform: uppercase;
  opacity: 0.9;
}

.icon-btn {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: none;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  font-size: 16px;
  line-height: 1;
  display: grid;
  place-items: center;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.items {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  font-size: 14px;
  border-left: 3px solid transparent;
}
.item:hover {
  background: rgba(255, 255, 255, 0.12);
}
.item:hover .actions {
  opacity: 1;
}
.item.active {
  background: rgba(255, 255, 255, 0.22);
  border-left-color: #fff;
  font-weight: 600;
}

.swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
  flex: none;
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rename-input {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: #fff;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 3px;
  padding: 2px 6px;
  outline: none;
}

.actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.1s;
}

.mini {
  background: none;
  border: none;
  font-size: 12px;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.85);
}
.mini:hover {
  background: rgba(255, 255, 255, 0.2);
}
.mini.danger:hover {
  color: #ffb3b3;
}

.progress {
  margin-left: 4px;
}

.footer {
  margin-top: auto;
  padding: 8px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}
</style>

