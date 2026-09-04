<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useNotesStore } from '@/stores/notesStore'

const authStore = useAuthStore()
const notesStore = useNotesStore()
const loadingData = ref(true)

async function loadData() {
  if (authStore.isAuthenticated && !notesStore.loaded) {
    try {
      await notesStore.loadFromServer()
    } catch (err) {
      console.error('Failed to load notebooks and pages:', err)
    }
  }
  loadingData.value = false
}

onMounted(() => {
  // Watch for auth state changes and load when authenticated
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth) {
        loadData()
      }
    },
    { immediate: true }
  )

  // Best-effort flush on tab close (keepalive skips service worker)
  window.addEventListener('beforeunload', () => {
    const activePageId = notesStore.pages[0]?.id
    if (activePageId && notesStore.pageById(activePageId)) {
      notesStore.savePage(activePageId).catch(() => {
        /* non-fatal */
      })
    }
  })
})
</script>

<template>
  <div v-if="loadingData" class="loading">Loading...</div>
  <router-view v-else />
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-size: 1.2rem;
  color: #666;
}
</style>

