import MockAdapter from 'axios-mock-adapter'
import {
  AxiosHeaders,
  CanceledError,
  isAxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type GenericAbortSignal,
} from 'axios'
import { match, pathToRegexp } from 'path-to-regexp'
import { login, logout, me } from './auth'
import { simulateFailure } from './failures'
import { HttpError, type MockRequest, type MockResponse } from './http'
import {
  cancelOrder,
  changeOrderStatus,
  createOrder,
  getOrder,
  listOrders,
  updateOrder,
} from './orders'

export { DEMO_ACCOUNTS } from './users'
export { default as MockControls } from './MockControls.vue'

type Method = 'get' | 'post' | 'put' | 'patch'

interface Route {
  method: Method
  path: string
  handler: (request: MockRequest) => MockResponse
}

const ROUTES: Route[] = [
  { method: 'post', path: '/auth/login', handler: login },
  { method: 'post', path: '/auth/logout', handler: logout },
  { method: 'get', path: '/me', handler: me },
  { method: 'get', path: '/orders', handler: listOrders },
  { method: 'post', path: '/orders', handler: createOrder },
  { method: 'get', path: '/orders/:id', handler: getOrder },
  { method: 'put', path: '/orders/:id', handler: updateOrder },
  { method: 'patch', path: '/orders/:id/status', handler: changeOrderStatus },
  { method: 'post', path: '/orders/:id/cancel', handler: cancelOrder },
]

export interface MockApiOptions {
  /** Latency per response in ms. Defaults to a random 300–1000 ms, like a real network. */
  delay?: (request: MockRequest) => number
}

const randomLatency = () => 300 + Math.random() * 700

/** Resolves after `ms`, or rejects like a real cancelled request if the caller aborts. */
function wait(ms: number, signal?: GenericAbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new CanceledError())
    const onAbort = () => {
      clearTimeout(timer)
      reject(new CanceledError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener?.('abort', onAbort)
  })
}

function parseBody(data: unknown): unknown {
  if (typeof data !== 'string' || data === '') return data
  try {
    return JSON.parse(data)
  } catch {
    throw new HttpError(400, 'The request body must be valid JSON.')
  }
}

function bearerToken({ headers }: AxiosRequestConfig): string | null {
  const header =
    headers instanceof AxiosHeaders ? headers.get('Authorization') : headers?.Authorization
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : null
}

/** Plugs into the app's own axios instance, so its interceptors run exactly as in production. */
export function installMockApi(http: AxiosInstance, options: MockApiOptions = {}): MockAdapter {
  const delay = options.delay ?? randomLatency
  const adapter = new MockAdapter(http)
  const register = {
    get: (matcher: RegExp) => adapter.onGet(matcher),
    post: (matcher: RegExp) => adapter.onPost(matcher),
    put: (matcher: RegExp) => adapter.onPut(matcher),
    patch: (matcher: RegExp) => adapter.onPatch(matcher),
  }

  async function respond(config: AxiosRequestConfig, route?: Route): Promise<MockResponse> {
    const path = config.url ?? ''
    const matched = route && match<Record<string, string>>(route.path)(path)
    const request: MockRequest = {
      method: config.method ?? 'get',
      path,
      params: matched ? { ...matched.params } : {},
      query: (config.params as Record<string, unknown> | undefined) ?? {},
      body: undefined,
      token: bearerToken(config),
    }

    // Every response is delayed, errors included, as a real network would.
    await wait(delay(request), config.signal)

    try {
      request.body = parseBody(config.data)
      const simulated = simulateFailure(request, config)
      if (simulated) return simulated
      if (!route) throw new HttpError(404, 'Not found.')
      return route.handler(request)
    } catch (error) {
      if (error instanceof HttpError) return error.toResponse()
      if (isAxiosError(error)) throw error // simulated network failure
      console.error('[mock api]', error)
      return [500, { message: 'Internal server error.' }]
    }
  }

  // path-to-regexp's patterns are anchored (^…$), which matters: the adapter tests them against
  // both the path and baseURL + path.
  for (const route of ROUTES) {
    register[route.method](pathToRegexp(route.path).regexp).reply((config) =>
      respond(config, route),
    )
  }
  adapter.onAny().reply((config) => respond(config))

  return adapter
}
