import { screen, waitFor, within } from '@testing-library/vue'
import { onlineManager } from '@tanstack/vue-query'
import { describe, expect, it, onTestFinished } from 'vitest'
import type { OrderStatus } from '@/features/orders/types'
import { formatMoney } from '@/lib/format'
import { orderAmount, readDb, updateDb } from '@/mocks/db'
import { armFailure } from '@/mocks/failures'
import { findAlert, renderAs, seededOrder, useNarrowScreen } from './render-app'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Intl puts a non-breaking space after "IQD"; Testing Library normalises page text to spaces. */
const money = (amount: number) => formatMoney(amount).replace(/\s/g, ' ')

/** Order numbers as listed on screen, top to bottom. */
const listedOrders = () =>
  screen.queryAllByRole('rowheader').map((cell) => cell.textContent?.trim())

/** What the server should return for a search, computed independently from the seed data. */
function ordersMatching({ q = '', status }: { q?: string; status?: OrderStatus }) {
  return readDb()
    .orders.filter((order) => !status || order.status === status)
    .filter(
      (order) =>
        order.customer.name.toLowerCase().includes(q) || order.number.toLowerCase().includes(q),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((order) => order.number)
}

describe('orders list', () => {
  it('searches and filters on the server, keeping both in the URL', async () => {
    const { user, router } = await renderAs('manager')
    await screen.findAllByRole('rowheader')

    await user.click(screen.getByRole('radio', { name: 'Delivered' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search orders' }), 'al-')

    const expected = ordersMatching({ q: 'al-', status: 'delivered' })
    expect(expected.length).toBeGreaterThan(1)
    await waitFor(() => expect(listedOrders()).toEqual(expected))
    expect(router.currentRoute.value.query).toEqual({ status: 'delivered', q: 'al-' })
    expect(screen.getByText(`${expected.length} orders found`)).toBeInTheDocument()
  })

  it('shows the latest results even when an earlier search responds last', async () => {
    // The first search ("al") is slow; the refined one ("al-rubaie") is instant.
    const { user } = await renderAs('manager', '/orders', {
      delay: ({ path, query }) => (path === '/orders' && query.q === 'al' ? 500 : 0),
    })
    await screen.findAllByRole('rowheader')
    const search = screen.getByRole('searchbox', { name: 'Search orders' })

    await user.type(search, 'al')
    await sleep(350) // past the debounce: the slow "al" request is in flight
    await user.type(search, '-rubaie')

    const expected = ordersMatching({ q: 'al-rubaie' })
    expect(ordersMatching({ q: 'al' })).not.toEqual(expected)
    await waitFor(() => expect(listedOrders()).toEqual(expected))

    await sleep(600) // the "al" response would have arrived by now
    expect(listedOrders()).toEqual(expected)
    expect(search).toHaveValue('al-rubaie')
  })

  it('explains when nothing matches and clears the filters in one click', async () => {
    const { user, router } = await renderAs('manager', '/orders?q=nobody&status=pending')

    expect(
      await screen.findByRole('heading', { name: 'No orders match these filters' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(listedOrders()).toEqual(ordersMatching({})))
    const search = screen.getByRole('searchbox', { name: 'Search orders' })
    expect(search).toHaveValue('')
    expect(search).toHaveFocus() // the button went away with the empty state
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it("doesn't relabel an empty result with the next search while that one loads", async () => {
    const { user } = await renderAs('manager', '/orders?q=nobody', {
      delay: ({ query }) => (query.q === 'ali' ? 200 : 0),
    })
    await screen.findByRole('heading', { name: 'No orders match these filters' })

    const search = screen.getByRole('searchbox', { name: 'Search orders' })
    await user.clear(search)
    await user.type(search, 'ali')
    await sleep(350) // debounce done, results for "ali" still on their way

    expect(screen.queryByText(/Nothing matches “ali”/)).not.toBeInTheDocument()
    await waitFor(() => expect(listedOrders()).toEqual(ordersMatching({ q: 'ali' })))
  })

  it('drops a pending search when the user moves to another page', async () => {
    const { user, router } = await renderAs('admin')
    await screen.findAllByRole('rowheader')

    await user.type(screen.getByRole('searchbox', { name: 'Search orders' }), 'ali')
    await user.click(screen.getByRole('link', { name: 'Admin' })) // before the debounce fires
    await screen.findByRole('heading', { level: 1, name: 'Admin' })
    await sleep(400)

    expect(router.currentRoute.value.fullPath).toBe('/admin')
  })
})

describe('on a phone', () => {
  it('lists orders as cards that open with the keyboard and get focus back', async () => {
    useNarrowScreen()
    const order = readDb().orders[readDb().orders.length - 1]!
    const { user } = await renderAs('support')

    const cards = await screen.findByRole('list', { name: 'Orders' })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    const card = within(cards).getAllByRole('link')[0]!
    expect(card).toHaveTextContent(order.number)

    card.focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog', { name: order.number })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(within(cards).getAllByRole('link')[0]).toHaveFocus())
  })
})

describe('order details', () => {
  it('opens from the keyboard, shows the whole order and closes with Escape', async () => {
    const order = [...readDb().orders].reverse().find((candidate) => candidate.items.length > 1)!
    const { user, router } = await renderAs('manager')

    const link = await screen.findByRole('link', { name: order.number })
    link.focus()
    await user.keyboard('{Enter}')

    const panel = await screen.findByRole('dialog', { name: order.number })
    await waitFor(() =>
      expect(within(panel).getByRole('heading', { name: order.number })).toHaveFocus(),
    )
    expect(await within(panel).findByText(order.customer.address)).toBeInTheDocument()
    for (const item of order.items) {
      expect(within(panel).getByText(item.product)).toBeInTheDocument()
    }
    expect(within(panel).getByRole('rowheader', { name: 'Total' }).closest('tr')).toHaveTextContent(
      money(orderAmount(order)),
    )
    expect(router.currentRoute.value.name).toBe('order-details')

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('link', { name: order.number })).toHaveFocus())
    expect(router.currentRoute.value.name).toBe('orders')
  })

  it('opens straight from a link, on top of the filtered list', async () => {
    const order = readDb().orders.find((candidate) => candidate.status === 'shipped')!
    const { router } = await renderAs('support', `/orders/${order.id}?status=shipped`)

    const panel = await screen.findByRole('dialog', { name: order.number })
    expect(await within(panel).findByText(order.customer.name)).toBeInTheDocument()
    expect(router.currentRoute.value.query).toEqual({ status: 'shipped' })
  })

  it('explains when an order does not exist', async () => {
    await renderAs('manager', '/orders/9999')

    const panel = await screen.findByRole('dialog')
    expect(
      await within(panel).findByRole('heading', { name: 'Order not found' }),
    ).toBeInTheDocument()
  })
})

describe('creating and editing orders', () => {
  it('checks the form, then creates the order and shows it in the list and details', async () => {
    const { user } = await renderAs('manager')
    await screen.findAllByRole('rowheader')

    await user.click(screen.getByRole('link', { name: 'New order' }))
    const panel = await screen.findByRole('dialog', { name: 'New order' })

    await user.click(within(panel).getByRole('button', { name: 'Create order' }))
    const name = within(panel).getByLabelText('Full name')
    expect(name).toHaveAccessibleDescription("Enter the customer's full name.")
    await waitFor(() => expect(name).toHaveFocus())
    expect(within(panel).getByLabelText('Product')).toHaveAccessibleDescription(
      'Enter a product name.',
    )

    await user.type(name, 'Zahraa Mohammed')
    await user.type(within(panel).getByLabelText('Mobile number'), '+964 770 123 4567')
    await user.type(within(panel).getByLabelText('Delivery address'), 'Street 12, Karrada, Baghdad')
    const first = within(panel).getByRole('group', { name: 'Item 1' })
    await user.type(within(first).getByLabelText('Product'), 'Smart watch')
    await user.clear(within(first).getByLabelText('Quantity'))
    await user.type(within(first).getByLabelText('Quantity'), '2')
    await user.type(within(first).getByLabelText('Unit price (IQD)'), '95,000')
    await user.click(within(panel).getByRole('button', { name: 'Add item' }))
    const second = within(panel).getByRole('group', { name: 'Item 2' })
    await waitFor(() => expect(within(second).getByLabelText('Product')).toHaveFocus())
    // A new item isn't flagged before the user has had a chance to fill it in.
    expect(within(second).getByLabelText('Product')).not.toHaveAccessibleDescription()
    expect(within(second).getByLabelText('Unit price (IQD)')).not.toHaveAccessibleDescription()
    await user.keyboard('Phone case')
    await user.type(within(second).getByLabelText('Unit price (IQD)'), '12000')
    expect(within(panel).getByText(money(202_000))).toBeInTheDocument()

    await user.click(within(panel).getByRole('button', { name: 'Create order' }))

    const created = await screen.findByRole('dialog', { name: 'ORD-1051' })
    expect(await screen.findByText('ORD-1051 created')).toBeInTheDocument()
    expect(within(created).getByText('0770 123 4567')).toBeInTheDocument()
    expect(within(created).getByText('Phone case')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(listedOrders()[0]).toBe('ORD-1051'))
  })

  it('edits an order and shows the change in the details and the list', async () => {
    const order = seededOrder('processing')
    const { user } = await renderAs('manager', `/orders/${order.id}`)
    const details = await screen.findByRole('dialog', { name: order.number })

    await user.click(await within(details).findByRole('link', { name: 'Edit' }))
    const editor = await screen.findByRole('dialog', { name: `Edit ${order.number}` })
    const name = await within(editor).findByLabelText('Full name')
    expect(name).toHaveValue(order.customer.name)
    await user.clear(name)
    await user.type(name, 'Renamed Customer')
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))

    const updated = await screen.findByRole('dialog', { name: order.number })
    expect(await within(updated).findByText('Renamed Customer')).toBeInTheDocument()
    expect(await screen.findByText(`${order.number} updated`)).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: order.number }).closest('tr')).toHaveTextContent(
        'Renamed Customer',
      ),
    )
  })

  it('stays put while a save is in flight, then finishes normally', async () => {
    const order = seededOrder('pending')
    const { user, router } = await renderAs('manager', `/orders/${order.id}/edit`, {
      delay: ({ method }) => (method === 'put' ? 300 : 0),
    })
    const editor = await screen.findByRole('dialog', { name: `Edit ${order.number}` })
    const name = await within(editor).findByLabelText('Full name')
    await user.clear(name)
    await user.type(name, 'Saved while waiting')

    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))
    await user.keyboard('{Escape}') // trying to leave mid-save does nothing...
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(router.currentRoute.value.name).toBe('order-edit')

    // ...and once saved, the panel shows the result.
    expect(await screen.findByText(`${order.number} updated`)).toBeInTheDocument()
    await waitFor(() => expect(router.currentRoute.value.name).toBe('order-details'))
  })

  it('groups amounts as they are typed, and refuses decimals instead of dropping them', async () => {
    const { user } = await renderAs('manager', '/orders/new')
    const panel = await screen.findByRole('dialog', { name: 'New order' })
    const quantity = within(panel).getByLabelText('Quantity')
    const price = within(panel).getByLabelText('Unit price (IQD)')

    await user.clear(quantity)
    await user.type(quantity, '2.5') // not silently 25 (or 2): the user is asked
    await user.type(price, '1250000')
    expect(quantity).toHaveValue('2.5')
    expect(price).toHaveValue('1,250,000')
    await user.click(within(panel).getByRole('button', { name: 'Create order' }))

    expect(quantity).toHaveAccessibleDescription('Use a whole number.')
    expect(price).not.toHaveAttribute('aria-invalid')
  })

  it("doesn't leave a save hanging when the browser reports being offline", async () => {
    const order = seededOrder('pending')
    const { user } = await renderAs('manager', `/orders/${order.id}/edit`)
    const editor = await screen.findByRole('dialog', { name: `Edit ${order.number}` })
    await within(editor).findByLabelText('Full name')

    onlineManager.setOnline(false)
    onTestFinished(() => onlineManager.setOnline(true))
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))

    // The request is made (and here, against the in-browser mock, succeeds) instead of waiting.
    expect(await screen.findByText(`${order.number} updated`)).toBeInTheDocument()
  })

  it('asks before throwing away unsaved changes', async () => {
    const { user, router } = await renderAs('manager', '/orders/new')
    const panel = await screen.findByRole('dialog', { name: 'New order' })
    await user.type(within(panel).getByLabelText('Full name'), 'Half-finished')

    await user.keyboard('{Escape}')
    const confirm = await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' })
    await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }))
    expect(router.currentRoute.value.name).toBe('order-create')
    expect(within(panel).getByLabelText('Full name')).toHaveValue('Half-finished')

    await user.keyboard('{Escape}')
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Discard changes',
      }),
    )
    await waitFor(() => expect(router.currentRoute.value.name).toBe('orders'))
  })
})

describe('when the API fails', () => {
  it('explains a failed load and recovers with "Try again"', async () => {
    const { user } = await renderAs('manager')
    await screen.findAllByRole('rowheader')

    // Arm a server error from the Mock API panel, then load another view.
    await user.click(screen.getByText(/Mock API/))
    ;(await screen.findByLabelText('Simulate a failure')).focus()
    await user.keyboard('{Enter}')
    await user.click(await screen.findByRole('option', { name: 'Server error (500)' }))
    armFailure('server-error', 1) // tests don't retry automatically: one failure is enough
    await user.click(screen.getByRole('radio', { name: 'Shipped' }))

    expect(
      await screen.findByRole('heading', { name: "We couldn't load the orders" }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findAllByRole('rowheader')).not.toHaveLength(0)
  })

  it('keeps what is on screen, and unsaved edits, when a background refresh fails', async () => {
    const order = seededOrder('pending')
    const { user, queryClient } = await renderAs('manager', `/orders/${order.id}/edit`)
    const editor = await screen.findByRole('dialog', { name: `Edit ${order.number}` })
    const name = await within(editor).findByLabelText('Full name')
    await user.clear(name)
    await user.type(name, 'Typed, not saved yet')

    armFailure('server-error', 1)
    await queryClient.refetchQueries({ queryKey: ['orders', 'detail', order.id] })

    expect(within(editor).getByLabelText('Full name')).toHaveValue('Typed, not saved yet')

    // The details view keeps the loaded order too, and says the refresh failed.
    await user.click(within(editor).getByRole('button', { name: 'Cancel' }))
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Discard changes',
      }),
    )
    const details = await screen.findByRole('dialog', { name: order.number })
    await within(details).findByText(order.customer.name)
    armFailure('server-error', 1)
    await queryClient.refetchQueries({ queryKey: ['orders', 'detail', order.id] })

    expect(await within(details).findByRole('alert')).toHaveTextContent(
      "Couldn't refresh this order. Something went wrong on our side.",
    )
    expect(within(details).getByText(order.customer.name)).toBeInTheDocument()
  })

  it("brings a failed save to the user's attention", async () => {
    const order = seededOrder('pending')
    const { user } = await renderAs('manager', `/orders/${order.id}/edit`)
    const editor = await screen.findByRole('dialog', { name: `Edit ${order.number}` })
    await within(editor).findByLabelText('Full name')

    armFailure('server-error')
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))

    const message = await findAlert(/Something went wrong on our side/, editor)
    await waitFor(() => expect(message).toHaveFocus()) // focusing also scrolls it into view

    // The simulated failure was for that one attempt: saving again goes through.
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(`${order.number} updated`)).toBeInTheDocument()
  })

  it('keeps a server error with its line item when another item is removed', async () => {
    const order = readDb().orders.find((o) => o.status === 'pending' && o.items.length >= 2)!
    const last = order.items[order.items.length - 1]!
    armFailure('validation') // the server flags the last item's quantity
    const { user } = await renderAs('manager', `/orders/${order.id}/edit`)
    const editor = await screen.findByRole('dialog', { name: `Edit ${order.number}` })
    const quantityOf = (product: string) => {
      const group = within(editor)
        .getAllByRole('group', { name: /^Item \d+$/ })
        .find(
          (candidate) =>
            within(candidate).getByLabelText<HTMLInputElement>('Product').value === product,
        )!
      return within(group).getByLabelText('Quantity')
    }

    await user.click(await within(editor).findByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(quantityOf(last.product)).toHaveAccessibleDescription('Only 2 left in stock.'),
    )

    await user.click(within(editor).getByRole('button', { name: 'Remove item 1' }))

    expect(quantityOf(last.product)).toHaveAccessibleDescription('Only 2 left in stock.')
  })

  it('stops offering the form once the order has become final', async () => {
    const order = seededOrder('pending')
    const { user } = await renderAs('manager', `/orders/${order.id}/edit`)
    const editor = await screen.findByRole('dialog', { name: `Edit ${order.number}` })
    await within(editor).findByLabelText('Full name')

    // Someone else cancels it while this form is open.
    updateDb((db) => {
      db.orders.find((candidate) => candidate.id === order.id)!.status = 'cancelled'
    })
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))

    expect(
      await within(editor).findByRole('heading', { name: "This order can't be edited" }),
    ).toBeInTheDocument()
    expect(within(editor).queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('says so when a refresh finds the order gone', async () => {
    const order = seededOrder('pending')
    const { queryClient } = await renderAs('manager', `/orders/${order.id}`)
    const panel = await screen.findByRole('dialog', { name: order.number })
    await within(panel).findByText(order.customer.name)

    updateDb((db) => {
      db.orders = db.orders.filter((candidate) => candidate.id !== order.id)
    })
    await queryClient.refetchQueries({ queryKey: ['orders', 'detail', order.id] })

    expect(
      await within(panel).findByRole('heading', { name: 'Order not found' }),
    ).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: /Mark as/ })).not.toBeInTheDocument()
  })

  it("shows the API's 422 errors under the matching fields", async () => {
    const order = seededOrder('pending')
    armFailure('validation')
    const { user } = await renderAs('manager', `/orders/${order.id}/edit`)
    const editor = await screen.findByRole('dialog', { name: `Edit ${order.number}` })

    await user.click(await within(editor).findByRole('button', { name: 'Save changes' }))

    const phone = within(editor).getByLabelText('Mobile number')
    await waitFor(() =>
      expect(phone).toHaveAccessibleDescription(/already linked to another customer/),
    )
    await waitFor(() => expect(phone).toHaveFocus())
    const lastItem = within(editor).getByRole('group', { name: `Item ${order.items.length}` })
    const quantity = within(lastItem).getByLabelText('Quantity')
    expect(quantity).toHaveAccessibleDescription('Only 2 left in stock.')

    // Editing a field clears its server error; the other one stays until it's addressed.
    await user.clear(phone)
    await user.type(phone, '0780 000 0000')
    expect(phone).not.toHaveAccessibleDescription(/already linked/)
    expect(quantity).toHaveAccessibleDescription('Only 2 left in stock.')

    // The simulated failure was for one save only: saving again goes through.
    await user.click(within(editor).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(`${order.number} updated`)).toBeInTheDocument()
  })
})
