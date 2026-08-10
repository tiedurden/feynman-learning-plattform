<script setup lang="ts">
import type { Notebook } from '@/types'

defineProps<{
  notebooks: Notebook[]
  activeId?: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add'): void
}>()
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
      >
        <span class="swatch" :style="{ background: nb.color }" />
        <span class="title">{{ nb.title }}</span>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.notebook-list {
  background: var(--nb-purple);
  color: #fff;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
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
</style>

