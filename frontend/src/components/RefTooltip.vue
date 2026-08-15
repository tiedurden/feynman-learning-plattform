<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** Breadcrumb segments, e.g. ['History', 'The French Revolution', 'Napoleon']. */
  path: string[]
  /** Viewport-relative anchor rect of the hovered link. */
  rect: DOMRect | null
}>()

const style = computed(() => {
  if (!props.rect) return { display: 'none' }
  return {
    left: `${props.rect.left + props.rect.width / 2}px`,
    top: `${props.rect.top}px`
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="rect && path.length" class="ref-tooltip" :style="style" role="tooltip">
      <span class="ref-tooltip-icon">🔗</span>
      <span class="ref-tooltip-path">
        <template v-for="(seg, i) in path" :key="i">
          <span class="seg">{{ seg }}</span>
          <span v-if="i < path.length - 1" class="sep">›</span>
        </template>
      </span>
    </div>
  </Teleport>
</template>

<style scoped>
.ref-tooltip {
  position: fixed;
  transform: translate(-50%, calc(-100% - 8px));
  z-index: 1200;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 360px;
  padding: 6px 10px;
  background: #201f1e;
  color: #fff;
  font-size: 12px;
  line-height: 1.3;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  white-space: nowrap;
}
.ref-tooltip::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -5px;
  transform: translateX(-50%);
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid #201f1e;
}
.ref-tooltip-icon {
  font-size: 11px;
}
.ref-tooltip-path {
  overflow: hidden;
  text-overflow: ellipsis;
}
.seg {
  opacity: 0.95;
}
.sep {
  margin: 0 5px;
  opacity: 0.55;
}
</style>

