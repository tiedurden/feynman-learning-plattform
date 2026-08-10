<script setup lang="ts">
import type { Notebook, PageNode } from '@/types'
import PageTreeItem from './PageTreeItem.vue'

defineProps<{
  notebook?: Notebook
  tree: PageNode[]
  activePageId?: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add-root'): void
  (e: 'add-child', parentId: string): void
  (e: 'delete', id: string): void
}>()
</script>

<template>
  <section class="page-tree">
    <div class="header">
      <span class="header-title">{{ notebook?.title ?? 'No notebook' }}</span>
      <button
        class="icon-btn"
        title="New page"
        :disabled="!notebook"
        @click="emit('add-root')"
      >
        ＋
      </button>
    </div>

    <div class="tree-scroll">
      <ul v-if="tree.length" class="tree-root">
        <PageTreeItem
          v-for="node in tree"
          :key="node.id"
          :node="node"
          :depth="0"
          :active-page-id="activePageId"
          @select="(id) => emit('select', id)"
          @add-child="(id) => emit('add-child', id)"
          @delete="(id) => emit('delete', id)"
        />
      </ul>
      <p v-else class="empty">No pages yet. Click ＋ to create one.</p>
    </div>
  </section>
</template>

<style scoped>
.page-tree {
  background: var(--pane-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px 10px;
  border-bottom: 1px solid var(--sidebar-border);
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  background: transparent;
  color: var(--accent);
  border: 1px solid var(--sidebar-border);
  border-radius: 4px;
  width: 24px;
  height: 24px;
  font-size: 16px;
  line-height: 1;
  display: grid;
  place-items: center;
}
.icon-btn:hover:not(:disabled) {
  background: var(--hover);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tree-scroll {
  overflow-y: auto;
  flex: 1;
  padding: 6px 0;
}

.tree-root {
  list-style: none;
  margin: 0;
  padding: 0;
}

.empty {
  color: var(--text-muted);
  font-size: 13px;
  padding: 16px;
  text-align: center;
}
</style>

