<script setup lang="ts">
import { ref } from 'vue'
import type { PageNode } from '@/types'
import ProgressBadge from './ProgressBadge.vue'
import { getProgress } from '@/utils/progress'

const props = defineProps<{
  node: PageNode
  depth: number
  activePageId?: string
  showProgress?: boolean
}>()

// Recursive components must self-reference by name for the template compiler.
defineOptions({ name: 'PageTreeItem' })

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add-child', parentId: string): void
  (e: 'delete', id: string): void
}>()

const expanded = ref(true)
const hasChildren = () => props.node.children.length > 0

function toggle(event: MouseEvent) {
  event.stopPropagation()
  expanded.value = !expanded.value
}
</script>

<template>
  <li class="tree-item">
    <div
      class="row"
      :class="{ active: node.id === activePageId }"
      :style="{ paddingLeft: 8 + depth * 16 + 'px' }"
      @click="emit('select', node.id)"
    >
      <button
        class="twisty"
        :class="{ invisible: !hasChildren() }"
        @click="toggle"
      >
        {{ expanded ? '▾' : '▸' }}
      </button>

      <span class="page-icon">📄</span>
      <span class="label">{{ node.title || 'Untitled' }}</span>

      <ProgressBadge
        v-if="showProgress"
        class="progress"
        :value="getProgress(node.id)"
      />

      <span class="actions">
        <button
          class="mini"
          title="Add sub-page"
          @click.stop="emit('add-child', node.id)"
        >
          ＋
        </button>
        <button
          class="mini danger"
          title="Delete page"
          @click.stop="emit('delete', node.id)"
        >
          🗑
        </button>
      </span>
    </div>

    <ul v-if="hasChildren() && expanded" class="children">
      <PageTreeItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :active-page-id="activePageId"
        :show-progress="showProgress"
        @select="(id) => emit('select', id)"
        @add-child="(id) => emit('add-child', id)"
        @delete="(id) => emit('delete', id)"
      />
    </ul>
  </li>
</template>

<style scoped>
.tree-item {
  list-style: none;
}

.row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px 5px 0;
  font-size: 14px;
  border-left: 3px solid transparent;
  user-select: none;
}
.row:hover {
  background: var(--hover);
}
.row:hover .actions {
  opacity: 1;
}
.row.active {
  background: var(--active);
  border-left-color: var(--accent);
  font-weight: 600;
}

.twisty {
  background: none;
  border: none;
  width: 16px;
  height: 16px;
  padding: 0;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1;
  flex: none;
}
.twisty.invisible {
  visibility: hidden;
}

.page-icon {
  font-size: 12px;
  flex: none;
}

.label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress {
  margin: 0 4px;
}

.actions {
  display: flex;
  gap: 2px;
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
  color: var(--text-muted);
}
.mini:hover {
  background: rgba(0, 0, 0, 0.08);
}
.mini.danger:hover {
  color: #a4262c;
}

.children {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>

