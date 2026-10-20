import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import type MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import type { Order, OrderStatus, OrderSummary } from '@/features/orders/types'
import { installMockApi } from '@/mocks'
import { readDb } from '@/mocks/db'
import { DEMO_PASSWORD, ROLE_PERMISSIONS, type Role } from '@/mocks/users'

/*
 * Contract tests for the mock API: the server must enforce the same rules as the UI, so a
 * forged request (or a stale screen) can't do more than the user is allowed to.
 */

let api: AxiosInstance
let adapter: MockAdapter

beforeEach(() => {
  // A bare client with no app interceptors that resolves on every status, so we can assert on it.
  api = axios.create({ baseURL: '/api', validateStatus: () => true })
  adapter = installMockApi(api, { delay: () => 0 })
})

afterEach(() => adapter.restore())

async function signIn(role: Role): Promise<AxiosRequestConfig> {
  const { data } = await api.post('/auth/login', {
    email: `${role}@example.com`,
    password: DEMO_PASSWORD,
  })
  return { headers: { Authorization: `Bearer ${data.token}` } }
}

function anOrder(status: OrderStatus) {
  const order = readDb().orders.find((candidate) => candidate.status === status)
  if (!order) throw new Error(`Seed data has no ${status} order`)
  return order
}

const validOrder = {
  customer: {
    name: 'Zahraa Mohammed',
    phone: '07701234567',
    address: 'Street 12, Karrada, Baghdad',
  },
  items: [{ product: 'Smart watch', quantity: 2, unitPrice: 95_000 }],
}

describe('authentication', () => {
  it('returns a token for valid credentials, 401 for wrong ones and 422 for missing ones', async () => {
    const ok = await api.post('/auth/login', {
      email: ' Admin@Example.com ',
      password: DEMO_PASSWORD,
    })
    expect(ok.status).toBe(200)
    expect(ok.data.token).toEqual(expect.any(String))

    const wrong = await api.post('/auth/login', { email: 'admin@example.com', password: 'nope' })
    expect(wrong.status).toBe(401)

    const missing = await api.post('/auth/login', { email: '', password: '' })
    expect(missing.status).toBe(422)
    expect(Object.keys(missing.data.errors)).toEqual(['email', 'password'])
  })

  it('identifies the caller from the token and rejects missing or unknown tokens', async () => {
    expect((await api.get('/orders')).status).toBe(401)
    expect((await api.get('/orders', { headers: { Authorization: 'Bearer forged' } })).status).toBe(
      401,
    )
    expect((await api.get('/orders', await signIn('support'))).status).toBe(200)
  })

  it('returns the current user with their role and full permission list from /me', async () => {
    const { data } = await api.get('/me', await signIn('manager'))
    expect(data).toEqual({
      id: 2,
      name: 'Sara Ali',
      role: 'manager',
      permissions: [
        'orders.view',
        'orders.view_amount',
        'orders.create',
        'orders.update',
        'orders.update_status',
      ],
    })
  })

  it('revokes the token on logout', async () => {
    const admin = await signIn('admin')
    expect((await api.post('/auth/logout', null, admin)).status).toBe(204)
    expect((await api.get('/me', admin)).status).toBe(401)
  })
})

describe('permissions', () => {
  it('never sends order amounts to users without orders.view_amount', async () => {
    const support = await signIn('support')
    const { data: list } = await api.get<OrderSummary[]>('/orders', support)
    expect(list.length).toBeGreaterThan(0)
    expect(list.some((order) => 'amount' in order)).toBe(false)

    const { data: order } = await api.get<Order>(`/orders/${list[0]!.id}`, support)
    expect(order).not.toHaveProperty('amount')
    expect(order.items.some((item) => 'unitPrice' in item)).toBe(false)

    const { data: managerList } = await api.get<OrderSummary[]>('/orders', await signIn('manager'))
    expect(managerList.every((summary) => typeof summary.amount === 'number')).toBe(true)
  })

  it.each([
    ['support', 'creates an order', 'post', '/orders'],
    ['support', 'edits an order', 'put', '/orders/:id'],
    ['support', 'changes a status', 'patch', '/orders/:id/status'],
    ['manager', 'cancels an order', 'post', '/orders/:id/cancel'],
  ] as const)('returns 403 when %s %s', async (role, _action, method, path) => {
    const { id } = anOrder('pending')
    const response = await api.request({
      ...(await signIn(role)),
      method,
      url: path.replace(':id', String(id)),
      data: method === 'patch' ? { status: 'processing' } : validOrder,
    })
    expect(response.status).toBe(403)
    expect(anOrder('pending').id).toBe(id) // nothing changed
  })
})

describe('order rules', () => {
  it('refuses to create or edit orders for users who cannot see amounts', async () => {
    // Orders carry prices: a role that can't see them mustn't be able to overwrite them.
    ROLE_PERMISSIONS.support.push('orders.create', 'orders.update')
    onTestFinished(() => {
      ROLE_PERMISSIONS.support.splice(1)
    })
    const support = await signIn('support')
    const { id } = anOrder('pending')

    expect((await api.post('/orders', validOrder, support)).status).toBe(403)
    expect((await api.put(`/orders/${id}`, validOrder, support)).status).toBe(403)
  })

  it.each(['delivered', 'cancelled'] as const)(
    'rejects every change to a %s order, even from an admin',
    async (status) => {
      const admin = await signIn('admin')
      const { id } = anOrder(status)
      const responses = [
        await api.put(`/orders/${id}`, validOrder, admin),
        await api.patch(`/orders/${id}/status`, { status: 'shipped' }, admin),
        await api.post(`/orders/${id}/cancel`, null, admin),
      ]
      for (const response of responses) {
        expect(response.status).toBe(409)
        expect(response.data.code).toBe('ORDER_FINAL')
      }
    },
  )

  it('only moves an order one step forward and never cancels through a status change', async () => {
    const manager = await signIn('manager')
    const { id } = anOrder('pending')

    const skip = await api.patch(`/orders/${id}/status`, { status: 'delivered' }, manager)
    expect(skip.status).toBe(409)
    expect(skip.data.code).toBe('INVALID_TRANSITION')

    const sneakyCancel = await api.patch(`/orders/${id}/status`, { status: 'cancelled' }, manager)
    expect(sneakyCancel.status).toBe(422)

    const next = await api.patch(`/orders/${id}/status`, { status: 'processing' }, manager)
    expect(next.status).toBe(200)
    expect(next.data.status).toBe('processing')
  })

  it('returns 422 with a message for each invalid field', async () => {
    const response = await api.post(
      '/orders',
      {
        customer: { name: '', phone: '123', address: '' },
        items: [
          { product: 'Laptop stand', quantity: 1, unitPrice: 30_000 },
          { product: '', quantity: 0, unitPrice: 1.5 },
        ],
      },
      await signIn('manager'),
    )
    expect(response.status).toBe(422)
    expect(Object.keys(response.data.errors).sort()).toEqual([
      'customer.address',
      'customer.name',
      'customer.phone',
      'items.1.product',
      'items.1.quantity',
      'items.1.unitPrice',
    ])
  })

  it('creates pending orders and computes the amount itself, ignoring client-sent values', async () => {
    const response = await api.post(
      '/orders',
      { ...validOrder, status: 'delivered', amount: 1 },
      await signIn('manager'),
    )
    expect(response.status).toBe(201)
    expect(response.data).toMatchObject({
      status: 'pending',
      amount: 190_000,
      customer: { phone: '0770 123 4567' },
    })
  })
})

it('searches by customer or order number and filters by status on the server', async () => {
  const manager = await signIn('manager')
  const expected = readDb()
    .orders.filter((order) => order.status === 'delivered' && order.customer.name.includes('Al-'))
    .map((order) => order.id)
  expect(expected.length).toBeGreaterThan(0)

  const { data } = await api.get<OrderSummary[]>('/orders', {
    ...manager,
    params: { q: '  al-  ', status: 'delivered' },
  })
  expect(data.map((order) => order.id).sort((a, b) => a - b)).toEqual(expected)
  // newest first
  expect(data.map((order) => order.createdAt)).toEqual(
    data
      .map((order) => order.createdAt)
      .sort()
      .reverse(),
  )

  const { data: byNumber } = await api.get<OrderSummary[]>('/orders', {
    ...manager,
    params: { q: 'ord-1007' },
  })
  expect(byNumber.map((order) => order.number)).toEqual(['ORD-1007'])
})
