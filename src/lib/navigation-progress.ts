import { computed, onUnmounted, ref } from 'vue'
import type { Router } from 'vue-router'
import { pendingConfirmation } from '@/components/ui/confirm'

/** Long enough that a page already downloaded never flashes the bar. */
const DELAY_MS = 150

/**
 * True while a navigation is still loading: pages and panels download their code the first
 * time they're opened, and on a slow connection a click would otherwise seem to do nothing.
 */
export function useNavigationProgress(router: Router) {
  const pending = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function settle() {
    clearTimeout(timer)
    pending.value = false
  }

  const stopBefore = router.beforeEach(() => {
    clearTimeout(timer)
    timer = setTimeout(() => (pending.value = true), DELAY_MS)
  })
  const stopAfter = router.afterEach(settle)
  const stopError = router.onError(settle)
  onUnmounted(() => {
    settle()
    stopBefore()
    stopAfter()
    stopError()
  })

  // A navigation waiting on "Discard unsaved changes?" is waiting for the user, not loading.
  return computed(() => pending.value && pendingConfirmation.value === null)
}
