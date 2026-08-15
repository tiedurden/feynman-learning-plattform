<script setup lang="ts">
import { computed } from 'vue'
import {
  DEFAULT_THRESHOLDS,
  progressLevel,
  type ProgressThresholds
} from '@/utils/progress'

const props = defineProps<{
  /** Percent value 0–100. */
  value: number
  thresholds?: ProgressThresholds
  /** Optional LLM understanding notes, shown in the tooltip. */
  notes?: string
}>()

const level = computed(() =>
  progressLevel(props.value, props.thresholds ?? DEFAULT_THRESHOLDS)
)

const tooltip = computed(() => {
  const pct = `${Math.round(props.value)}% understanding`
  return props.notes ? `${pct} — ${props.notes}` : pct
})
</script>

<template>
  <span
    class="progress-badge"
    :class="level"
    :title="tooltip"
  >
    {{ Math.round(value) }}%
  </span>
</template>

<style scoped>
.progress-badge {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 999px;
  white-space: nowrap;
  background: color-mix(in srgb, currentColor 18%, transparent);
}

.progress-badge.danger {
  color: #e04a4e;
}
.progress-badge.warn {
  color: #d6a600;
}
.progress-badge.good {
  color: #2ea043;
}
</style>


