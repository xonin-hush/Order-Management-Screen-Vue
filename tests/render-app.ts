import { render, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { onTestFinished, vi } from 'vitest'
import { createMemoryHistory } from 'vue-router'
import App from '@/App.vue'
import { http } from '@/api/http'
import { createAppContext } from '@/app/context'
import { TOKEN_STORAGE_KEY } from '@/features/auth/session.store'
import type { OrderStatus } from '@/features/orders/types'
import { DEMO_ACCOUNTS, installMockApi, MockControls, type MockApiOptions } from '@/mocks'
import { readDb, updateDb } from '@/mocks/db'
import { USERS, type Role } from '@/mocks/users'

/**
 * Renders the real app (router guards, session, query cache, HTTP layer) against the mock API,
 * with no network latency unless a test asks for it.
 */
export async function renderApp(path = '/', { delay = () => 0 }: MockApiOptions = {}) {
  const mock = installMockApi(http, { delay })
  const context = createAppContext({
    history: createMemoryHistory(),
    demoAccounts: DEMO_ACCOUNTS,
    devTools: MockControls,
  })
  // Fail fast: retries only slow tests down.
  context.queryClient.setDefaultOptions({
    ...context.queryClient.getDefaultOptions(),
    queries: { ...context.queryClient.getDefaultOptions().queries, retry: false },
  })
  onTestFinished(() => {
    context.queryClient.clear()
    mock.restore()
  })

  await context.router.push(path)
  const user = userEvent.setup()
  const view = render(App, {
    // Real transitions, as in a browser: Vuetify's overlays only unmount once they've finished.
    global: { plugins: [context], stubs: { transition: false, 'transition-group': false } },
  })
  return {
    ...view,
    user,
    mock,
    router: context.router,
    queryClient: context.queryClient,
    pinia: context.pinia,
  }
}

/** Seeds a server session and a stored token, as if the user had signed in before a reload. */
export function storeSession(role: Role): string {
  const user = USERS.find((candidate) => candidate.role === role)!
  const token = `test-token-${role}`
  updateDb((db) => {
    db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() })
  })
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  return token
}

/** Opens the app already signed in as the given role. */
export function renderAs(role: Role, path = '/orders', options?: MockApiOptions) {
  storeSession(role)
  return renderApp(path, options)
}

/** Makes `min-width` media queries fail for this test, i.e. a phone-sized screen. */
export function useNarrowScreen() {
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )
  onTestFinished(() => spy.mockRestore())
}

/** A seeded order in the given status (the seed guarantees every status exists). */
export function seededOrder(status: OrderStatus) {
  const order = readDb().orders.find((candidate) => candidate.status === status)
  if (!order) throw new Error(`The seed has no ${status} order`)
  return order
}

/**
 * The alert showing `text`. Testing Library's `findByRole('alert')` would be ambiguous: every
 * Vuetify field also has an alert region, for its own messages.
 */
export async function findAlert(text: string | RegExp, container: HTMLElement = document.body) {
  const message = await within(container).findByText(text)
  const alert = message.closest<HTMLElement>('[role="alert"]')
  if (!alert) throw new Error(`"${message.textContent}" isn't shown in an alert`)
  return alert
}
