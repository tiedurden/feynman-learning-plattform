<script setup lang="ts">
import { ref } from 'vue'
import type { PageNode } from '@/types'

const props = defineProps<{
  node: PageNode
  depth: number
  selectedPageId?: string
}>()

defineOptions({ name: 'PickerPageItem' })

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

const expanded = ref(true)
const hasChildren = () => props.node.children.length > 0
</script>

<template>
  <li class="picker-item">
    <div
      class="row"
      :class="{ selected: node.id === selectedPageId }"
      :style="{ paddingLeft: 8 + depth * 16 + 'px' }"
      @click="emit('select', node.id)"
    >
      <button
        class="twisty"
        :class="{ invisible: !hasChildren() }"
        @click.stop="expanded = !expanded"
      >
        {{ expanded ? '▾' : '▸' }}
      </button>
      <span class="page-icon">📄</span>
      <span class="label">{{ node.title || 'Untitled' }}</span>
    </div>

    <ul v-if="hasChildren() && expanded" class="children">
      <PickerPageItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-page-id="selectedPageId"
        @select="(id) => emit('select', id)"
      />
    </ul>
  </li>
</template>

<style scoped>
.picker-item {
  list-style: none;
}
.row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px 4px 0;
  font-size: 14px;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}
.row:hover {
  background: var(--hover, #f3f2f1);
}
.row.selected {
  background: var(--active, #ede1f5);
  font-weight: 600;
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
.children {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>

