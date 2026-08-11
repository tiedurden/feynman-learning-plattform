<script setup lang="ts">
/**
 * A pill-style on/off switch (not a checkbox/radio).
 *
 * Renders as an accessible `role="switch"` button so no native input is
 * involved — this guarantees a consistent switch appearance across browsers.
 */
const props = defineProps<{
  /** Current on/off state. */
  modelValue?: boolean
  /** Text shown next to the switch. */
  label?: string
  /** Color tone: 'light' for light backgrounds, 'dark' for dark sidebars. */
  tone?: 'light' | 'dark'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

function toggle() {
  const next = !props.modelValue
  emit('update:modelValue', next)
  emit('change', next)
}
</script>

<template>
  <label class="toggle" :class="tone ?? 'light'">
    <span v-if="label" class="toggle-label">{{ label }}</span>
    <button
      type="button"
      role="switch"
      class="switch"
      :class="{ on: modelValue }"
      :aria-checked="modelValue ? 'true' : 'false'"
      @click.stop="toggle"
    >
      <span class="knob" />
    </button>
  </label>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-label {
  white-space: nowrap;
}

.switch {
  position: relative;
  flex: none;
  width: 36px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}
.switch.on .knob {
  transform: translateX(16px);
}

/* Light tone (default) --------------------------------------------------- */
.toggle.light {
  color: var(--text-muted, #605e5c);
}
.toggle.light .switch {
  background: var(--sidebar-border, #c8c6c4);
}
.toggle.light .switch.on {
  background: var(--accent, #7719aa);
}
.toggle.light .switch:focus-visible {
  outline: 2px solid var(--accent, #7719aa);
  outline-offset: 2px;
}

/* Dark tone -------------------------------------------------------------- */
.toggle.dark {
  color: rgba(255, 255, 255, 0.9);
}
.toggle.dark .switch {
  background: rgba(255, 255, 255, 0.3);
}
.toggle.dark .switch.on {
  background: rgba(255, 255, 255, 0.9);
}
.toggle.dark .switch.on .knob {
  background: var(--nb-purple, #7719aa);
}
.toggle.dark .switch:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 2px;
}
</style>

