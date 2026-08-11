<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    /** Style the confirm button as a destructive action. */
    danger?: boolean
  }>(),
  {
    title: 'Are you sure?',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    danger: false
  }
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const confirmBtn = ref<HTMLButtonElement | null>(null)

/** CSS class for the confirm button based on the `danger` prop. */
const confirmButtonClass = computed(() => (props.danger ? 'btn-danger' : 'btn-primary'))

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') emit('cancel')
}

// Autofocus the confirm button whenever the dialog opens.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await Promise.resolve()
      confirmBtn.value?.focus()
    }
  }
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="overlay"
        role="dialog"
        aria-modal="true"
        @click.self="emit('cancel')"
      >
        <div class="dialog">
          <h2 class="dialog-title">{{ title }}</h2>
          <p v-if="message" class="dialog-message">{{ message }}</p>

          <div class="dialog-actions">
            <button class="btn" @click="emit('cancel')">{{ cancelLabel }}</button>
            <button
              ref="confirmBtn"
              class="btn"
              :class="confirmButtonClass"
              @click="emit('confirm')"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
  z-index: 1000;
}

.dialog {
  background: var(--editor-bg);
  color: var(--text);
  width: min(420px, calc(100vw - 32px));
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
  padding: 20px 22px 18px;
}

.dialog-title {
  margin: 0 0 8px;
  font-size: 17px;
  font-weight: 600;
}

.dialog-message {
  margin: 0 0 18px;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.4;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  border: 1px solid var(--sidebar-border);
  background: var(--editor-bg);
  color: var(--text);
  border-radius: 4px;
  padding: 7px 16px;
  font-size: 14px;
  line-height: 1;
}
.btn:hover {
  background: var(--hover);
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.btn-primary:hover {
  filter: brightness(1.08);
}

.btn-danger {
  background: #a4262c;
  border-color: #a4262c;
  color: #fff;
}
.btn-danger:hover {
  filter: brightness(1.08);
}

/* Fade transition for the overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>





