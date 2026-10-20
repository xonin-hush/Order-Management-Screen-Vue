import type { Pinia } from 'pinia'
import { createRouter, type RouteRecordRaw, type RouterHistory } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import type { Permission } from '@/features/auth/permissions'
import { CREATE_ORDER_PERMISSIONS, EDIT_ORDER_PERMISSIONS } from '@/features/orders/permissions'
// Eager: it's the screen for when the network is unreliable, so it mustn't need a download.
import SessionUnavailableView from '@/features/auth/SessionUnavailableView.vue'
import { useSessionStore } from '@/features/auth/session.store'
import { safeRedirect } from '@/lib/navigation'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable without signing in. */
    public?: boolean
    /** Signed-in users are sent on into the app (e.g. away from the sign-in page). */
    guestOnly?: boolean
    /** All needed to enter this route and everything nested under it. */
    permissions?: readonly Permission[]
    title?: string
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/features/auth/LoginView.vue'),
    meta: { public: true, guestOnly: true, title: 'Sign in' },
  },
  {
    path: '/unavailable',
    name: 'session-unavailable',
    component: SessionUnavailableView,
    meta: { public: true, title: "Couldn't load your account" },
  },
  {
    path: '/',
    component: AppLayout,
    children: [
      { path: '', redirect: { name: 'orders' } },
      {
        path: 'orders',
        name: 'orders',
        component: () => import('@/features/orders/OrdersView.vue'),
        meta: { permissions: ['orders.view'], title: 'Orders' },
        // Panels open over the list, so its filters and scroll position survive.
        children: [
          {
            path: 'new',
            name: 'order-create',
            component: () => import('@/features/orders/OrderCreatePanel.vue'),
            meta: { permissions: CREATE_ORDER_PERMISSIONS, title: 'New order' },
          },
          {
            path: ':id(\\d+)',
            name: 'order-details',
            component: () => import('@/features/orders/OrderDetailsPanel.vue'),
            props: (route) => ({ id: Number(route.params.id) }),
            meta: { title: 'Order details' },
          },
          {
            path: ':id(\\d+)/edit',
            name: 'order-edit',
            component: () => import('@/features/orders/OrderEditPanel.vue'),
            props: (route) => ({ id: Number(route.params.id) }),
            meta: { permissions: EDIT_ORDER_PERMISSIONS, title: 'Edit order' },
          },
        ],
      },
      {
        path: 'admin',
        name: 'admin',
        // Lazy, so the guard stops users without access before its code is even downloaded.
        component: () => import('@/features/admin/AdminView.vue'),
        meta: { permissions: ['admin.access'], title: 'Admin' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/components/layout/NotFoundView.vue'),
        meta: { title: 'Page not found' },
      },
      {
        // Never matched by URL (the catch-all above wins); the guard renders it in place of a
        // page the user may not open, keeping the address they typed.
        path: ':deniedPath(.*)*',
        name: 'forbidden',
        component: () => import('@/components/layout/ForbiddenView.vue'),
        meta: { title: 'No access' },
      },
    ],
  },
]

export function createAppRouter(history: RouterHistory, pinia: Pinia) {
  const router = createRouter({ history, routes })

  router.beforeEach(async (to) => {
    const session = useSessionStore(pinia)
    await session.restore()

    // The session couldn't be verified (e.g. offline): show no protected page until it is.
    if (session.status === 'unavailable') {
      return to.name === 'session-unavailable'
        ? true
        : { name: 'session-unavailable', query: { redirect: to.fullPath } }
    }
    if (to.name === 'session-unavailable') {
      return safeRedirect(to.query.redirect) ?? { name: 'orders' }
    }

    if (to.meta.public) {
      if (to.meta.guestOnly && session.isAuthenticated) {
        return safeRedirect(to.query.redirect) ?? { name: 'orders' }
      }
      return true
    }

    if (!session.isAuthenticated) {
      return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
    }

    // Client-side checks are for UX only; the API enforces the same permissions.
    const denied = to.matched.some(
      ({ meta }) => meta.permissions !== undefined && !session.canAll(meta.permissions),
    )
    if (denied) {
      return {
        name: 'forbidden',
        params: { deniedPath: to.path.slice(1).split('/') },
        query: to.query,
        hash: to.hash,
        replace: true,
      }
    }
    return true
  })

  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · OrderDesk` : 'OrderDesk'
  })

  return router
}
