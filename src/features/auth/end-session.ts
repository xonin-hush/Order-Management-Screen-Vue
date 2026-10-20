import type { QueryClient } from '@tanstack/vue-query'
import type { Router } from 'vue-router'
import { dismissNotifications } from '@/lib/notify'
import { revokeToken } from './api'
import type { SessionStore } from './session.store'

export type EndSessionReason = 'signed-out' | 'expired'

interface SessionDeps {
  router: Router
  queryClient: QueryClient
  session: SessionStore
}

/**
 * The one way a session ends, whether the user signs out or the server rejects the token.
 * The order matters so that nothing from this user can reach the next one:
 * 1. forget the token, so late responses to it are discarded by the HTTP layer;
 * 2. leave for the sign-in page, unmounting every screen that shows their data;
 * 3. drop all cached server data (cancelling in-flight queries) and pending mutations;
 * 4. reset the session state and dismiss notifications about their work;
 * 5. revoke the token server-side, in the background.
 * Steps 3–5 run even if step 2 fails, which then falls back to a full page load.
 */
export async function endSession(
  { router, queryClient, session }: SessionDeps,
  reason: EndSessionReason,
) {
  const token = session.token
  if (!token) return

  const from = router.currentRoute.value
  const signIn =
    reason === 'expired'
      ? { name: 'login', query: { reason: 'expired', redirect: from.fullPath } }
      : { name: 'login' }
  session.forgetToken()

  try {
    await router.replace(signIn)
  } catch {
    // e.g. the sign-in page's code failed to load: a full page load leaves nothing behind.
    window.location.assign(router.resolve(signIn).href)
  } finally {
    queryClient.clear()
    queryClient.getMutationCache().clear()
    session.reset()
    dismissNotifications()
    // An expired token is already invalid; otherwise revoke it, ignoring failures.
    if (reason === 'signed-out') void revokeToken(token).catch(() => {})
  }
}
