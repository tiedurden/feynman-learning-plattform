<script setup lang="ts">
import { ref } from 'vue'
import type { NotebookTree } from '@/types'
import PickerPageItem from './PickerPageItem.vue'

const props = defineProps<{
  notebookTrees: NotebookTree[]
  selectedPageId?: string
}>()

const emit = defineEmits<{
  (e: 'select', pageId: string): void
}>()

// Track which notebooks are expanded (collapsed by default, except any that
// already contains the current selection).
const expanded = ref<Record<string, boolean>>(
  Object.fromEntries(
    props.notebookTrees.map((nt) => [
      nt.notebook.id,
      containsPage(nt, props.selectedPageId)
    ])
  )
)

function containsPage(nt: NotebookTree, pageId?: string): boolean {
  if (!pageId) return false
  const walk = (nodes: NotebookTree['tree']): boolean =>
    nodes.some((n) => n.id === pageId || walk(n.children))
  return walk(nt.tree)
}

function toggle(notebookId: string) {
  expanded.value[notebookId] = !expanded.value[notebookId]
}
</script>

<template>
  <div class="tree-picker">
    <ul class="notebooks">
      <li v-for="nt in notebookTrees" :key="nt.notebook.id" class="notebook">
        <div class="nb-row" @click="toggle(nt.notebook.id)">
          <button class="twisty" @click.stop="toggle(nt.notebook.id)">
            {{ expanded[nt.notebook.id] ? '▾' : '▸' }}
          </button>
          <span class="nb-dot" :style="{ background: nt.notebook.color }" />
          <span class="nb-title">{{ nt.notebook.title }}</span>
        </div>

        <ul v-if="expanded[nt.notebook.id]" class="pages">
          <PickerPageItem
            v-for="node in nt.tree"
            :key="node.id"
            :node="node"
            :depth="0"
            :selected-page-id="selectedPageId"
            @select="(id) => emit('select', id)"
          />
          <li v-if="!nt.tree.length" class="empty">No pages</li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tree-picker {
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--sidebar-border, #e1dfdd);
  border-radius: 6px;
  padding: 4px;
}
.notebooks,
.pages {
  list-style: none;
  margin: 0;
  padding: 0;
}
.notebook {
  margin-bottom: 2px;
}
.nb-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  font-size: 14px;
  color: var(--text, #201f1e);
}
.nb-row:hover {
  background: var(--hover, #f3f2f1);
}
.twisty {
  background: none;
  border: none;
  width: 16px;
  height: 16px;
  padding: 0;
  color: var(--text-muted, #605e5c);
  font-size: 10px;
  line-height: 1;
  flex: none;
  cursor: pointer;
}
.nb-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex: none;
}
.nb-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pages {
  padding-left: 8px;
}
.empty {
  color: var(--text-muted, #605e5c);
  font-size: 13px;
  padding: 4px 10px;
}
</style>

