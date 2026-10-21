import { screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { useSessionStore } from '@/features/auth/session.store'
import { readDb, updateDb } from '@/mocks/db'
import { DEMO_PASSWORD } from '@/mocks/users'
import { findAlert, renderApp, renderAs, seededOrder } from './render-app'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const signInHeading = { level: 1, name: 'Sign in to OrderDesk' } as const
const ordersHeading = { level: 1, name: 'Orders' } as const

/** Makes GET /me fail with a 500: a corrupt session row crashes the account service. */
function breakAccountService() {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {}) // the mock logs it
  onTestFinished(() => consoleError.mockRestore())
  updateDb((db) => {
    db.sessions.unshift(null as never)
  })
}

function repairAccountService() {
  updateDb((db) => {
    db.sessions = db.sessions.filter(Boolean)
  })
}

describe('signing in', () => {
  it('sends visitors to sign in, then back to the page they asked for', async () => {
    const { user, router } = await renderApp('/orders?status=pending')

    expect(await screen.findByRole('heading', signInHeading)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'manager@example.com')
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', ordersHeading)).toBeInTheDocument()
    expect(router.currentRoute.value.fullPath).toBe('/orders?status=pending')
    expect(screen.getByText('Sara Ali')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
  })

  it('checks the form before calling the API, then explains wrong credentials', async () => {
    const { user } = await renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    const email = screen.getByLabelText('Email')
    expect(email).toHaveAccessibleDescription('Enter your email address.')
    await waitFor(() => expect(email).toHaveFocus())

    await user.type(email, 'admin@example.com')
    await user.type(screen.getByLabelText('Password'), 'not-the-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await findAlert('Incorrect email or password.')).toBeInTheDocument()
    expect(screen.getByRole('heading', signInHeading)).toBeInTheDocument()
  })

  it('never follows a redirect to another site after signing in', async () => {
    const { user, router } = await renderApp('/login?redirect=//evil.example/phish')

    await user.click(await screen.findByRole('button', { name: 'Admin admin@example.com' }))
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('heading', ordersHeading)).toBeInTheDocument()
    expect(router.currentRoute.value.fullPath).toBe('/orders')
  })

  it('fills in a demo account in one click', async () => {
    const { user } = await renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Support support@example.com' }))
    expect(screen.getByLabelText('Email')).toHaveValue('support@example.com')
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', ordersHeading)).toBeInTheDocument()
    expect(screen.getByText('Yusuf Kareem')).toBeInTheDocument()
  })
})

describe('session', () => {
  it("doesn't guess when the account can't be loaded, and lets the user retry", async () => {
    breakAccountService()
    const { user, router, mock } = await renderAs('manager', '/admin')

    expect(
      await screen.findByRole('heading', { level: 1, name: "We couldn't load your account" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Something went wrong on our side. Please try again in a moment.'),
    ).toBeInTheDocument()
    expect(router.currentRoute.value.query.redirect).toBe('/admin')
    expect(localStorage.getItem('oms.token')).not.toBeNull() // not signed out
    // Asked once: being sent to this page doesn't count as a second attempt.
    expect(mock.history.get.filter((request) => request.url === '/me')).toHaveLength(1)

    repairAccountService()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    // Once we know who it is, the usual checks apply: a manager can't open /admin.
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'Admin' })).not.toBeInTheDocument()
  })

  it("offers a way out when the account can't be loaded", async () => {
    breakAccountService()
    const { user, pinia } = await renderAs('manager', '/orders')
    await screen.findByRole('heading', { level: 1, name: "We couldn't load your account" })

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', signInHeading)).toBeInTheDocument()
    expect(localStorage.getItem('oms.token')).toBeNull()
    // Including why the account couldn't be loaded: the next user starts from a clean session.
    expect(useSessionStore(pinia).$state).toEqual({
      token: null,
      user: null,
      status: 'ready',
      unavailableReason: null,
    })
  })

  it('keeps the user signed in after a reload', async () => {
    await renderAs('support', '/orders')

    expect(await screen.findByRole('heading', ordersHeading)).toBeInTheDocument()
    expect(screen.getByText('Yusuf Kareem')).toBeInTheDocument()
  })

  it('leaves nothing from the previous user behind when switching accounts', async () => {
    const { user, queryClient } = await renderAs('admin')
    await screen.findAllByRole('rowheader')
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', signInHeading)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)

    await user.type(screen.getByLabelText('Email'), 'support@example.com')
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findAllByRole('rowheader')

    expect(screen.getByText('Yusuf Kareem')).toBeInTheDocument()
    expect(screen.queryByText('Layla Hassan')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Amount' })).not.toBeInTheDocument()
    expect(screen.queryByText(/IQD/)).not.toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('signs the user out when the API rejects their session, then brings them back', async () => {
    const { user, router } = await renderAs('manager', '/orders?status=pending')
    await screen.findAllByRole('rowheader')

    // The session ends elsewhere (revoked, expired) while the page is open.
    updateDb((db) => {
      db.sessions = []
    })
    await user.click(screen.getByRole('radio', { name: 'Shipped' }))

    expect(await screen.findByRole('heading', signInHeading)).toBeInTheDocument()
    expect(await findAlert(/Your session has expired/)).toBeInTheDocument()
    expect(localStorage.getItem('oms.token')).toBeNull()

    await user.type(screen.getByLabelText('Email'), 'manager@example.com')
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await screen.findAllByRole('rowheader')
    expect(router.currentRoute.value.fullPath).toBe('/orders?status=shipped')
  })

  it('never removes the session another tab has signed in with', async () => {
    const { user } = await renderAs('manager')
    await screen.findAllByRole('rowheader')

    // Meanwhile another tab signs someone else in (the token storage is shared)...
    localStorage.setItem('oms.token', 'token-from-another-tab')
    // ...and this tab's own session is rejected on its next request.
    updateDb((db) => {
      db.sessions = []
    })
    await user.click(screen.getByRole('radio', { name: 'Shipped' }))

    expect(await screen.findByRole('heading', signInHeading)).toBeInTheDocument()
    expect(localStorage.getItem('oms.token')).toBe('token-from-another-tab')
  })

  it('drops responses that arrive after the user who asked for them signed out', async () => {
    const order = seededOrder('pending')
    // The admin's change is slow, and revoking their token is slower still, so the change
    // succeeds and its response comes back after they've signed out.
    const { user, queryClient } = await renderAs('admin', `/orders/${order.id}`, {
      delay: ({ method, path }) => (method === 'patch' ? 400 : path === '/auth/logout' ? 1_000 : 0),
    })
    const panel = await screen.findByRole('dialog', { name: order.number })
    await user.click(await within(panel).findByRole('button', { name: 'Mark as processing' }))
    await user.keyboard('{Escape}')
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    await user.type(await screen.findByLabelText('Email'), 'support@example.com')
    await user.type(screen.getByLabelText('Password'), DEMO_PASSWORD)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await screen.findAllByRole('rowheader')
    await sleep(500) // the admin's response has arrived by now

    const cached = JSON.stringify(
      queryClient
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
    )
    expect(cached).not.toMatch(/amount|unitPrice/)
    expect(screen.queryByText(`${order.number} marked as processing`)).not.toBeInTheDocument()
  })

  it('signs out, revokes the session and keeps protected pages closed', async () => {
    const { user, router } = await renderAs('admin')

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', signInHeading)).toBeInTheDocument()
    expect(localStorage.getItem('oms.token')).toBeNull()
    await vi.waitFor(() => expect(readDb().sessions).toHaveLength(0))

    await router.push('/orders')
    expect(router.currentRoute.value.name).toBe('login')
  })
})
