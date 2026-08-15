<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

export interface MenuItem {
  label: string
  /** Optional destructive styling. */
  danger?: boolean
  action: () => void
}

const props = defineProps<{
  /** Viewport x/y where the menu should appear. */
  x: number
  y: number
  items: MenuItem[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function run(item: MenuItem) {
  item.action()
}

// Close on any outside interaction or escape.
function onDocPointerDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.link-context-menu')) emit('close')
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('mousedown', onDocPointerDown, true)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocPointerDown, true)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="link-context-menu"
      :style="{ left: props.x + 'px', top: props.y + 'px' }"
      role="menu"
    >
      <button
        v-for="(item, i) in items"
        :key="i"
        class="menu-item"
        :class="{ danger: item.danger }"
        role="menuitem"
        @click="run(item)"
      >
        {{ item.label }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.link-context-menu {
  position: fixed;
  z-index: 1300;
  min-width: 160px;
  background: var(--editor-bg, #fff);
  border: 1px solid var(--sidebar-border, #e1dfdd);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 4px;
}
.menu-item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 8px 10px;
  font: inherit;
  font-size: 14px;
  color: var(--text, #201f1e);
  cursor: pointer;
}
.menu-item:hover {
  background: var(--hover, #f3f2f1);
}
.menu-item.danger {
  color: #a4262c;
}
.menu-item.danger:hover {
  background: #fdf3f4;
}
</style>

