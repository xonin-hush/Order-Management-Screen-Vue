import axios, { AxiosHeaders, CanceledError, type InternalAxiosRequestConfig } from 'axios'
import { ApiError, toApiError } from './errors'

/** The one HTTP client. Without `VITE_API_BASE_URL`, `main.ts` attaches the mock API to it. */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15_000,
  headers: { Accept: 'application/json' },
})

export interface SessionHooks {
  /** Bearer token of the current session, or null when signed out. */
  getToken(): string | null
  /** A request made with the current token was rejected: the session is over. */
  onUnauthorized(): void
  /** A request was forbidden: our copy of the user's permissions may be stale. */
  onForbidden(): void
}

let session: SessionHooks = {
  getToken: () => null,
  onUnauthorized: () => {},
  onForbidden: () => {},
}

/** The interceptors below are registered once and call these hooks, so tests can swap them. */
export function configureHttp(hooks: SessionHooks) {
  session = hooks
}

function bearerToken(config: InternalAxiosRequestConfig | undefined): string | null {
  const header =
    config?.headers instanceof AxiosHeaders ? config.headers.get('Authorization') : null
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : null
}

/**
 * A response to a request sent with an older token belongs to a previous session. Dropping it
 * keeps that user's data out of the next user's cache.
 */
function assertCurrentSession(config: InternalAxiosRequestConfig | undefined) {
  if (bearerToken(config) !== session.getToken()) {
    throw new CanceledError('Response belongs to a previous session', undefined, config)
  }
}

http.interceptors.request.use((config) => {
  const token = session.getToken()
  // An explicit header wins: sign-out revokes the old token after it has been cleared locally.
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

http.interceptors.response.use(
  (response) => {
    assertCurrentSession(response.config)
    // e.g. a misconfigured base URL answered by the dev server's index.html
    if (typeof response.data === 'string' && response.data.trimStart().startsWith('<')) {
      throw new ApiError('server', 'The server sent an unexpected response.', response.status)
    }
    return response
  },
  (error: unknown) => {
    // CanceledError extends AxiosError, so check it first: aborted requests aren't failures.
    if (axios.isCancel(error) || !axios.isAxiosError(error)) throw error
    assertCurrentSession(error.config)

    const apiError = toApiError(error)
    const url = error.config?.url ?? ''
    // A 401 from /auth/* means "wrong credentials", not "session expired".
    if (apiError.kind === 'unauthorized' && !url.startsWith('/auth/')) session.onUnauthorized()
    if (apiError.kind === 'forbidden' && url !== '/me') session.onForbidden()
    throw apiError
  },
)
