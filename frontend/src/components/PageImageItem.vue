<script setup lang="ts">
import type { PageImage } from '@/types'

defineProps<{
  image: PageImage
  src?: string
}>()

const emit = defineEmits<{
  (e: 'drag-start', event: MouseEvent): void
  (e: 'remove'): void
}>()
</script>

<template>
  <div
    class="page-image"
    :style="{ left: `${image.x}px`, top: `${image.y}px` }"
    @mousedown.stop="emit('drag-start', $event)"
  >
    <img v-if="src" :src="src" :alt="image.fileName" draggable="false" />
    <span v-else class="image-loading" role="status">Loading image…</span>
    <button
      class="remove-image"
      type="button"
      :aria-label="`Remove image ${image.fileName}`"
      title="Remove image"
      @mousedown.stop
      @click.stop="emit('remove')"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.page-image {
  position: absolute;
  z-index: 1;
  display: inline-flex;
  max-width: 280px;
  max-height: 260px;
  cursor: grab;
  user-select: none;
}

.page-image:active {
  cursor: grabbing;
}

.page-image img {
  display: block;
  max-width: 280px;
  max-height: 260px;
  object-fit: contain;
  pointer-events: none;
}

.image-loading {
  min-width: 180px;
  min-height: 80px;
  display: grid;
  place-items: center;
  border: 1px solid #e1dfdd;
  border-radius: 4px;
  color: #605e5c;
  background: #faf9f8;
}

.remove-image {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  color: #fff;
  background: rgb(32 31 30 / 75%);
  font-size: 18px;
  line-height: 24px;
  opacity: 0;
}

.page-image:hover .remove-image,
.remove-image:focus-visible {
  opacity: 1;
}
</style>
