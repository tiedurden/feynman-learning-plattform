import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import { useAuthStore } from '@/stores/authStore'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/register', name: 'register', component: RegisterView, meta: { public: true } },
    {
      path: '/',
      name: 'home',
      component: AppLayout
    },
    {
      path: '/notebook/:id',
      name: 'notebook',
      component: AppLayout,
      props: true
    },
    {
      path: '/notebook/:id/page/:pageId',
      name: 'page',
      component: AppLayout,
      props: true
    }
  ]
})

// Gate every non-public route behind login; bounce logged-in users away from the auth pages.
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.public && auth.isAuthenticated) {
    return { name: 'home' }
  }
})


