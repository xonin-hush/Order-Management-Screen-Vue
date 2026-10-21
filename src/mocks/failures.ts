import { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { match } from 'path-to-regexp'
import { reactive } from 'vue'
import { isRecord, type MockRequest, type MockResponse } from './http'

/**
 * Simulated failures. Each is armed for the next order request(s), then switches itself off, so
 * the recovery can be seen too. Sign-in and /me are never affected.
 */
export const FAILURE_MODES = [
  { value: 'off', label: 'Off', times: 0, description: 'Requests behave normally.' },
  {
    value: 'server-error',
    label: 'Server error (500)',
    // Loads are retried once automatically, so fail twice to reach the error screen.
    times: 2,
    description: 'The next order request fails with a 500; trying again works.',
  },
  {
    value: 'network-error',
    label: 'Network error',
    times: 2,
    description: 'The next order request gets no answer, as if the connection dropped.',
  },
  {
    value: 'unauthorized',
    label: 'Session expired (401)',
    times: 1,
    description: 'The next order request is rejected, which ends the session.',
  },
  {
    value: 'forbidden-writes',
    label: 'Forbidden change (403)',
    times: 1,
    description:
      'The next save, status change or cancellation is refused, as if access was revoked.',
  },
  {
    value: 'validation',
    label: 'Validation errors (422)',
    times: 1,
    description: 'The next order save returns field errors, for rules only a server can check.',
  },
] as const

export type FailureMode = (typeof FAILURE_MODES)[number]['value']

export const failure = reactive<{ mode: FailureMode; remaining: number }>({
  mode: 'off',
  remaining: 0,
})

/** Arms a failure for the next matching request(s); `off` disarms. */
export function armFailure(
  mode: FailureMode,
  times: number = FAILURE_MODES.find((option) => option.value === mode)!.times,
) {
  failure.mode = mode
  failure.remaining = times
}

function respondWith<T>(request: MockRequest, result: T): T {
  // Only loads are retried automatically; a failed save or status change is one attempt, so
  // the user's next try goes through.
  failure.remaining = request.method === 'get' ? failure.remaining - 1 : 0
  if (failure.remaining <= 0) armFailure('off')
  return result
}

const orderPath = match('/orders/:id')

function isOrderSave({ method, path }: MockRequest) {
  return (method === 'post' && path === '/orders') || (method === 'put' && Boolean(orderPath(path)))
}

/** A response to return instead of the real one, or null to answer normally. */
export function simulateFailure(
  request: MockRequest,
  config: AxiosRequestConfig,
): MockResponse | null {
  if (failure.mode === 'off' || !request.path.startsWith('/orders')) return null

  switch (failure.mode) {
    case 'server-error':
      return respondWith(request, [500, { message: 'Simulated server error.' }])
    case 'network-error':
      // No response at all, exactly like a dropped connection.
      throw respondWith(
        request,
        new AxiosError(
          'Network Error',
          AxiosError.ERR_NETWORK,
          config as InternalAxiosRequestConfig,
        ),
      )
    case 'unauthorized':
      return respondWith(request, [
        401,
        { message: 'Your session has expired. Please sign in again.' },
      ])
    case 'forbidden-writes':
      if (request.method === 'get') return null
      return respondWith(request, [403, { message: "You don't have permission to do that." }])
    case 'validation': {
      if (!isOrderSave(request)) return null
      const items =
        isRecord(request.body) && Array.isArray(request.body.items) ? request.body.items : []
      // Real field paths, as a server would send for rules only it can check.
      return respondWith(request, [
        422,
        {
          message: 'Some details need your attention.',
          errors: {
            'customer.phone': 'This number is already linked to another customer.',
            [`items.${Math.max(items.length - 1, 0)}.quantity`]: 'Only 2 left in stock.',
          },
        },
      ])
    }
  }
}
