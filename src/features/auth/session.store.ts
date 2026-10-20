import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { isApiError } from '@/api/errors'
import { fetchCurrentUser, requestToken } from './api'
import type { Permission } from './permissions'
import type { Credentials, CurrentUser } from './types'

/** Shared by every tab of the app, which is why only a tab's own token is ever removed. */
export const TOKEN_STORAGE_KEY = 'oms.token'

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function storeToken(token: string | null, previous: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
    // Another tab may have signed someone in since; their token isn't ours to remove.
    else if (readStoredToken() === previous) localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // Storage unavailable: the session still works until the page is reloaded.
  }
}

/**
 * - `unknown`: a stored token hasn't been checked yet
 * - `ready`: we know who the user is (or that nobody is signed in)
 * - `unavailable`: `/me` failed for a reason other than 401, so we can't tell either way
 */
export type SessionStatus = 'unknown' | 'ready' | 'unavailable'

/**
 * Who the user is and what they may do. Only the token is stored; user and permissions are
 * always re-read from `GET /me`.
 */
export const useSessionStore = defineStore('session', () => {
  const token = ref<string | null>(readStoredToken())
  const user = ref<CurrentUser | null>(null)
  const status = ref<SessionStatus>('unknown')
  /** Why the session couldn't be verified (status `unavailable`), to tell the user. */
  const unavailableReason = shallowRef<unknown>(null)

  const isAuthenticated = computed(() => token.value !== null && user.value !== null)
  const permissions = computed(() => new Set(user.value?.permissions))
  /** "warehouse_staff" → "Warehouse staff": new roles need no client change to display. */
  const roleLabel = computed(() => {
    const role = user.value?.role.split('_').join(' ') ?? ''
    return role.charAt(0).toUpperCase() + role.slice(1)
  })

  function can(permission: Permission): boolean {
    return permissions.value.has(permission)
  }

  function canAll(required: readonly Permission[]): boolean {
    return required.every(can)
  }

  function setToken(value: string | null) {
    const previous = token.value
    token.value = value
    storeToken(value, previous)
  }

  async function loadUser() {
    if (!token.value) {
      status.value = 'ready'
      return
    }
    try {
      user.value = await fetchCurrentUser()
      status.value = 'ready'
    } catch (error) {
      if (isApiError(error, 'unauthorized')) {
        setToken(null)
        status.value = 'ready'
      } else {
        // Don't sign people out because of a flaky network; let them retry.
        unavailableReason.value = error
        status.value = 'unavailable'
      }
    }
  }

  let pendingRestore: Promise<void> | null = null

  /** Resolves who is signed in, once. Safe to await on every navigation; only `retry()` asks again. */
  function restore(): Promise<void> {
    if (status.value !== 'unknown') return Promise.resolve()
    pendingRestore ??= loadUser().finally(() => {
      pendingRestore = null
    })
    return pendingRestore
  }

  async function signIn(credentials: Credentials) {
    setToken(await requestToken(credentials))
    try {
      user.value = await fetchCurrentUser()
      status.value = 'ready'
    } catch (error) {
      setToken(null)
      throw error
    }
  }

  let pendingRefresh: Promise<void> | null = null

  /** Re-reads permissions after a 403 suggested ours are stale. */
  function refreshUser(): Promise<void> {
    pendingRefresh ??= fetchCurrentUser()
      .then((freshUser) => {
        user.value = freshUser
      })
      .catch(() => {}) // keep the current view; a 401 is handled by the HTTP layer
      .finally(() => {
        pendingRefresh = null
      })
    return pendingRefresh
  }

  /** First step of signing out: from here on, responses to the old token are discarded. */
  function forgetToken() {
    setToken(null)
    status.value = 'ready' // without a token, it's known that nobody is signed in
  }

  function reset() {
    setToken(null)
    user.value = null
    status.value = 'ready'
  }

  /** For "Try again" after the session couldn't be verified. */
  function retry(): Promise<void> {
    status.value = 'unknown'
    return restore()
  }

  return {
    token,
    user,
    status,
    unavailableReason,
    isAuthenticated,
    roleLabel,
    can,
    canAll,
    restore,
    signIn,
    refreshUser,
    forgetToken,
    reset,
    retry,
  }
})

export type SessionStore = ReturnType<typeof useSessionStore>
