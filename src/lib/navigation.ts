import type { RouteLocationRaw, Router } from 'vue-router'

/**
 * Only same-app paths are allowed as post-login redirects: "/orders" yes, but not
 * "https://evil.example", "//evil.example" or "/\evil.example" (an open-redirect vector).
 */
export function safeRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/')) return null
  return value[1] === '/' || value[1] === '\\' ? null : value
}

/**
 * Leave a screen the way the user came: if the previous history entry is where we're going,
 * step back (so the Back button doesn't reopen what was just closed); otherwise replace.
 */
export function goBackOr(router: Router, destination: RouteLocationRaw) {
  const previous = router.options.history.state.back
  if (previous && previous === router.resolve(destination).fullPath) router.back()
  else void router.replace(destination)
}
