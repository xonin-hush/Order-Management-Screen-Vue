import { QueryClient } from '@tanstack/vue-query'
import { isApiError } from '@/api/errors'

/** Only transient failures are worth retrying; a 4xx will fail the same way again. */
function isTransient(error: unknown): boolean {
  return isApiError(error, 'network') || isApiError(error, 'server')
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Lists and details stay fresh for a short while, so moving between them is instant.
        staleTime: 30_000,
        retry: (failureCount, error) => failureCount < 1 && isTransient(error),
        // Always try: when offline, show the error (with retry) rather than an endless spinner.
        networkMode: 'always',
      },
      mutations: {
        // Writes are never retried automatically: the user decides whether to try again.
        retry: false,
        // Never pause a write while offline: the form would wait forever, then save later.
        networkMode: 'always',
      },
    },
  })
}
