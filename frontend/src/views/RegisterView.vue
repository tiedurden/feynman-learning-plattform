<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const displayName = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.register(email.value, password.value, displayName.value || undefined)
    router.replace('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Registration failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <form class="auth-card" @submit.prevent="submit">
      <h1>🧠 Feynman</h1>
      <p class="subtitle">Create your account</p>

      <label>
        Name
        <input v-model="displayName" type="text" autocomplete="name" />
      </label>
      <label>
        Email
        <input v-model="email" type="email" required autocomplete="email" />
      </label>
      <label>
        Password
        <input v-model="password" type="password" required minlength="8" autocomplete="new-password" />
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button class="submit" type="submit" :disabled="loading">
        {{ loading ? 'Creating account…' : 'Register' }}
      </button>

      <p class="switch">
        Already have an account? <router-link to="/login">Log in</router-link>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f3f7;
}
.auth-card {
  width: 320px;
  padding: 2rem;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
h1 {
  margin: 0;
  font-size: 1.4rem;
  text-align: center;
}
.subtitle {
  margin: 0 0 0.5rem;
  text-align: center;
  color: #666;
  font-size: 0.9rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #444;
}
input {
  padding: 0.5rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 0.95rem;
}
.submit {
  margin-top: 0.5rem;
  padding: 0.6rem;
  border: none;
  border-radius: 6px;
  background: #7719aa;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  margin: 0;
  color: #c0392b;
  font-size: 0.85rem;
}
.switch {
  margin: 0.25rem 0 0;
  text-align: center;
  font-size: 0.85rem;
}
</style>
