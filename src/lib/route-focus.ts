import { nextTick, onUnmounted } from 'vue'
import { START_LOCATION, type RouteLocationNormalized, type Router } from 'vue-router'

/** The page a route belongs to: opening a side panel (/orders → /orders/12) stays on the same page. */
function pageOf(route: RouteLocationNormalized) {
  return route.matched[1] ?? route.matched[0]
}

/** SPA navigation doesn't move focus like a page load does, so focus the new page's heading. */
export function useRouteFocus(router: Router) {
  const stop = router.afterEach((to, from, failure) => {
    if (failure || from === START_LOCATION || pageOf(to) === pageOf(from)) return
    void nextTick(() => document.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus())
  })
  onUnmounted(stop)
}
