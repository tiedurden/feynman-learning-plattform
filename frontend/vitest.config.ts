import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Dedicated Vitest config: reuses the Vue plugin and the "@" alias, and runs
// component tests in a jsdom DOM environment. Vitest picks this file over
// vite.config.ts automatically.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    restoreMocks: true
  }
})

