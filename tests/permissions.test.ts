import { screen, waitFor, within } from '@testing-library/vue'
import { describe, expect, it, onTestFinished } from 'vitest'
import { formatMoney } from '@/lib/format'
import { orderAmount, readDb, updateDb } from '@/mocks/db'
import { armFailure } from '@/mocks/failures'
import { ROLE_PERMISSIONS } from '@/mocks/users'
import { renderAs, seededOrder } from './render-app'

const mainNav = () => screen.getByRole('navigation', { name: 'Main' })

/** Intl puts a non-breaking space after "IQD"; Testing Library normalises page text to spaces. */
const money = (amount: number) => formatMoney(amount).replace(/\s/g, ' ')

describe('order amounts', () => {
  it('are shown to managers', async () => {
    await renderAs('manager')
    await screen.findAllByRole('rowheader')

    const { orders } = readDb()
    const newest = orders[orders.length - 1]!
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toBeInTheDocument()
    expect(screen.getAllByText(money(orderAmount(newest))).length).toBeGreaterThan(0)
  })

  it('are left out of order details for support users, who still see what was ordered', async () => {
    const order = readDb().orders.find((candidate) => candidate.items.length > 1)!
    await renderAs('support', `/orders/${order.id}`)

    const panel = await screen.findByRole('dialog', { name: order.number })
    expect(await within(panel).findByText(order.items[0]!.product)).toBeInTheDocument()
    expect(within(panel).getByRole('columnheader', { name: 'Qty' })).toBeInTheDocument()
    expect(within(panel).queryByText(/IQD/)).not.toBeInTheDocument()
  })

  it('are hidden from support users, who never receive them', async () => {
    await renderAs('support')
    await screen.findAllByRole('rowheader')

    expect(screen.queryByRole('columnheader', { name: 'Amount' })).not.toBeInTheDocument()
    expect(screen.queryByText(/IQD/)).not.toBeInTheDocument()
  })
})

describe('admin area', () => {
  it('is linked and reachable for users with admin.access', async () => {
    const { user, router } = await renderAs('admin', '/orders')

    await user.click(
      within(await screen.findByRole('navigation', { name: 'Main' })).getByRole('link', {
        name: 'Admin',
      }),
    )

    expect(await screen.findByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument()
    expect(router.currentRoute.value.name).toBe('admin')
  })

  it.each(['manager', 'support'] as const)(
    'is hidden from %s users and refuses them when they type its URL',
    async (role) => {
      const { router } = await renderAs(role, '/admin')

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: "You don't have access to this page",
        }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1, name: 'Admin' })).not.toBeInTheDocument()
      // The address the user typed is kept, so it's clear what was refused.
      expect(router.currentRoute.value.fullPath).toBe('/admin')
      expect(within(mainNav()).queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    },
  )
})

describe('order actions', () => {
  const statusOf = (id: number) => readDb().orders.find((order) => order.id === id)?.status

  it('are not offered to support users', async () => {
    const order = seededOrder('pending')
    await renderAs('support', `/orders/${order.id}`)

    const panel = await screen.findByRole('dialog', { name: order.number })
    await within(panel).findByText(order.customer.name)
    expect(within(panel).queryByRole('region', { name: 'Order actions' })).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /Mark as/ })).not.toBeInTheDocument()
  })

  it('let managers walk an order through the workflow, but not cancel it', async () => {
    const order = seededOrder('pending')
    const { user } = await renderAs('manager', `/orders/${order.id}`)
    const panel = await screen.findByRole('dialog', { name: order.number })

    await user.click(await within(panel).findByRole('button', { name: 'Mark as processing' }))
    expect(await screen.findByText(`${order.number} marked as processing`)).toBeInTheDocument()
    await user.click(await within(panel).findByRole('button', { name: 'Mark as shipped' }))
    expect(await screen.findByText(`${order.number} marked as shipped`)).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()

    // Delivered is final, so it asks first.
    await user.click(await within(panel).findByRole('button', { name: 'Mark as delivered' }))
    const confirm = await screen.findByRole('alertdialog', {
      name: `Mark ${order.number} as delivered?`,
    })
    await user.click(within(confirm).getByRole('button', { name: 'Mark as delivered' }))

    expect(await screen.findByText(`${order.number} marked as delivered`)).toBeInTheDocument()
    expect(statusOf(order.id)).toBe('delivered')
    await waitFor(() =>
      expect(within(panel).getByText(/Delivered orders are final/)).toBeInTheDocument(),
    )
    expect(within(panel).queryByRole('button', { name: /Mark as/ })).not.toBeInTheDocument()
  })

  it('let admins cancel an order, after confirming', async () => {
    const order = seededOrder('shipped')
    const { user } = await renderAs('admin', `/orders/${order.id}`)
    const panel = await screen.findByRole('dialog', { name: order.number })

    await user.click(await within(panel).findByRole('button', { name: 'Cancel order' }))
    let confirm = await screen.findByRole('alertdialog', { name: `Cancel ${order.number}?` })
    await user.click(within(confirm).getByRole('button', { name: 'Keep order' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(statusOf(order.id)).toBe('shipped')

    await user.click(within(panel).getByRole('button', { name: 'Cancel order' }))
    confirm = await screen.findByRole('alertdialog', { name: `Cancel ${order.number}?` })
    await user.click(within(confirm).getByRole('button', { name: 'Cancel order' }))

    expect(await screen.findByText(`${order.number} cancelled`)).toBeInTheDocument()
    expect(statusOf(order.id)).toBe('cancelled')
    await waitFor(() =>
      expect(within(panel).getByRole('button', { name: 'Cancel order' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    )
  })

  it("don't rely on hidden buttons: a 403 is explained and permissions re-checked", async () => {
    // The UI still thinks the action is allowed, but the API refuses (e.g. access was revoked).
    const order = seededOrder('pending')
    armFailure('forbidden-writes')
    const { user, mock } = await renderAs('manager', `/orders/${order.id}`)
    const panel = await screen.findByRole('dialog', { name: order.number })

    await user.click(await within(panel).findByRole('button', { name: 'Mark as processing' }))

    expect(await screen.findByText(`Couldn't update ${order.number}`)).toBeInTheDocument()
    expect(screen.getByText("You don't have permission to do that.")).toBeInTheDocument()
    // Still signed in, nothing changed, and /me was asked again in case permissions changed.
    expect(screen.getByRole('dialog', { name: order.number })).toBeInTheDocument()
    expect(statusOf(order.id)).toBe('pending')
    await waitFor(() =>
      expect(mock.history.get.filter((request) => request.url === '/me')).toHaveLength(2),
    )
  })

  it('explain a conflict when the order changed meanwhile, and show its new state', async () => {
    const order = seededOrder('shipped')
    const { user } = await renderAs('manager', `/orders/${order.id}`)
    const panel = await screen.findByRole('dialog', { name: order.number })
    await within(panel).findByRole('button', { name: 'Mark as delivered' })

    // Someone else cancels it while this panel is open.
    updateDb((db) => {
      db.orders.find((candidate) => candidate.id === order.id)!.status = 'cancelled'
    })
    await user.click(within(panel).getByRole('button', { name: 'Mark as delivered' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Mark as delivered',
      }),
    )

    expect(await screen.findByText(`Couldn't update ${order.number}`)).toBeInTheDocument()
    expect(
      screen.getByText('This order is cancelled and can no longer be changed.'),
    ).toBeInTheDocument()
    expect(await within(panel).findByText(/Cancelled orders are final/)).toBeInTheDocument()
  })

  it('keep delivered orders locked, even for admins, and say why', async () => {
    const order = seededOrder('delivered')
    const { user } = await renderAs('admin', `/orders/${order.id}`)
    const panel = await screen.findByRole('dialog', { name: order.number })

    const cancel = await within(panel).findByRole('button', { name: 'Cancel order' })
    expect(cancel).toHaveAttribute('aria-disabled', 'true')
    expect(cancel).toHaveAccessibleDescription(/Delivered orders are final/)
    expect(within(panel).queryByRole('button', { name: /Mark as/ })).not.toBeInTheDocument()

    await user.click(cancel)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(statusOf(order.id)).toBe('delivered')
  })
})

describe('permissions changing mid-session', () => {
  it('moves the user off a page they can no longer open', async () => {
    const { user } = await renderAs('manager')
    await screen.findAllByRole('rowheader')

    // An administrator revokes the manager's access to orders on the server.
    const granted = [...ROLE_PERMISSIONS.manager]
    ROLE_PERMISSIONS.manager.splice(0, granted.length, 'orders.create')
    onTestFinished(() => {
      ROLE_PERMISSIONS.manager.splice(0, ROLE_PERMISSIONS.manager.length, ...granted)
    })

    // The next request is refused (403), so the app re-reads /me and re-checks the page.
    await user.click(screen.getByRole('radio', { name: 'Pending' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sara Ali')).toBeInTheDocument() // still signed in
  })
})

describe('creating and editing', () => {
  it('also requires seeing amounts, since orders carry prices', async () => {
    // A new server-side role that may create and edit orders but not see amounts.
    ROLE_PERMISSIONS.support.push('orders.create', 'orders.update')
    onTestFinished(() => {
      ROLE_PERMISSIONS.support.splice(1)
    })
    const order = seededOrder('pending')
    const { router } = await renderAs('support', '/orders')
    await screen.findAllByRole('rowheader')
    expect(screen.queryByRole('link', { name: 'New order' })).not.toBeInTheDocument()

    await router.push(`/orders/${order.id}`)
    const panel = await screen.findByRole('dialog', { name: order.number })
    await within(panel).findByText(order.customer.name)
    expect(within(panel).queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()

    await router.push(`/orders/${order.id}/edit`)
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument()
  })

  it('is not offered to support users, and refused when they type the URL', async () => {
    const { router } = await renderAs('support', '/orders')
    await screen.findAllByRole('rowheader')
    expect(screen.queryByRole('link', { name: 'New order' })).not.toBeInTheDocument()

    await router.push('/orders/new')
    expect(
      await screen.findByRole('heading', { level: 1, name: "You don't have access to this page" }),
    ).toBeInTheDocument()
  })

  it('explains that a delivered order cannot be edited, even when opened by URL', async () => {
    const order = seededOrder('delivered')
    await renderAs('manager', `/orders/${order.id}/edit`)

    const panel = await screen.findByRole('dialog', { name: `Edit ${order.number}` })
    expect(
      await within(panel).findByRole('heading', { name: "This order can't be edited" }),
    ).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })
})
