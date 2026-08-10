import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
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

