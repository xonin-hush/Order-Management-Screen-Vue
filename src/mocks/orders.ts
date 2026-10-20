import { isFinal, isOrderStatus, nextStatuses, STATUS_LABELS } from '@/features/orders/domain'
import { CREATE_ORDER_PERMISSIONS, EDIT_ORDER_PERMISSIONS } from '@/features/orders/permissions'
import { orderInputSchema, toFieldErrors, type OrderInput } from '@/features/orders/schema'
import type { Order, OrderSummary } from '@/features/orders/types'
import { authenticate, authorize } from './auth'
import { orderAmount, readDb, updateDb, type MockDatabase, type OrderRecord } from './db'
import { HttpError, isRecord, type MockRequest, type MockResponse } from './http'
import { hasPermission, type MockUser } from './users'

/*
 * Every endpoint checks, in order: authentication (401) → permission (403) → existence (404)
 * → order state (409) → payload (422). Permission comes before existence so callers can't
 * probe for orders they aren't allowed to see.
 */

const canSeeAmounts = (user: MockUser) => hasPermission(user, 'orders.view_amount')

// Responses are built from an allow-list of fields, so money can't leak to users without
// `orders.view_amount` by accident when the record grows new fields.
function toSummary(order: OrderRecord, withAmounts: boolean): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    customerName: order.customer.name,
    status: order.status,
    createdAt: order.createdAt,
    ...(withAmounts ? { amount: orderAmount(order) } : {}),
  }
}

function toOrder(order: OrderRecord, withAmounts: boolean): Order {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    customer: { ...order.customer },
    items: order.items.map(({ id, product, quantity, unitPrice }) =>
      withAmounts ? { id, product, quantity, unitPrice } : { id, product, quantity },
    ),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ...(withAmounts ? { amount: orderAmount(order) } : {}),
  }
}

function findOrder(db: MockDatabase, id: string | undefined): OrderRecord {
  const order = db.orders.find((candidate) => candidate.id === Number(id))
  if (!order) throw new HttpError(404, "This order doesn't exist or has been removed.")
  return order
}

function assertNotFinal(order: OrderRecord) {
  if (isFinal(order.status)) {
    throw new HttpError(409, `This order is ${order.status} and can no longer be changed.`, {
      code: 'ORDER_FINAL',
    })
  }
}

function parseOrderInput(body: unknown): OrderInput {
  const result = orderInputSchema.safeParse(body)
  if (!result.success) {
    throw new HttpError(422, 'Some details need your attention.', {
      errors: toFieldErrors(result.error),
    })
  }
  return result.data
}

function toItems(db: MockDatabase, input: OrderInput) {
  return input.items.map((item) => ({ id: db.nextItemId++, ...item }))
}

/** GET /orders?q=&status= — search and filtering happen here, not in the UI. */
export function listOrders(request: MockRequest): MockResponse {
  const db = readDb()
  const user = authenticate(request, db)
  authorize(user, 'orders.view')

  const { q, status } = request.query
  if (status !== undefined && status !== '' && !isOrderStatus(status)) {
    throw new HttpError(422, 'Unknown status filter.', {
      errors: { status: 'Choose a valid status.' },
    })
  }
  const search = typeof q === 'string' ? q.trim().toLowerCase() : ''

  const orders = db.orders
    .filter((order) => !status || order.status === status)
    .filter(
      (order) =>
        !search ||
        order.customer.name.toLowerCase().includes(search) ||
        order.number.toLowerCase().includes(search),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return [200, orders.map((order) => toSummary(order, canSeeAmounts(user)))]
}

export function getOrder(request: MockRequest): MockResponse {
  const db = readDb()
  const user = authenticate(request, db)
  authorize(user, 'orders.view')
  return [200, toOrder(findOrder(db, request.params.id), canSeeAmounts(user))]
}

export function createOrder(request: MockRequest): MockResponse {
  return updateDb((db) => {
    const user = authenticate(request, db)
    CREATE_ORDER_PERMISSIONS.forEach((permission) => authorize(user, permission))
    // Only customer and items are accepted: status starts at "pending" and the amount is
    // always computed here, whatever the client sends.
    const input = parseOrderInput(request.body)

    const now = new Date().toISOString()
    const id = db.nextOrderId++
    const order: OrderRecord = {
      id,
      number: `ORD-${1000 + id}`,
      status: 'pending',
      customer: input.customer,
      items: toItems(db, input),
      createdAt: now,
      updatedAt: now,
    }
    db.orders.push(order)
    return [201, toOrder(order, canSeeAmounts(user))]
  })
}

export function updateOrder(request: MockRequest): MockResponse {
  return updateDb((db) => {
    const user = authenticate(request, db)
    EDIT_ORDER_PERMISSIONS.forEach((permission) => authorize(user, permission))
    const order = findOrder(db, request.params.id)
    assertNotFinal(order)
    const input = parseOrderInput(request.body)

    order.customer = input.customer
    order.items = toItems(db, input)
    order.updatedAt = new Date().toISOString()
    return [200, toOrder(order, canSeeAmounts(user))]
  })
}

export function changeOrderStatus(request: MockRequest): MockResponse {
  return updateDb((db) => {
    const user = authenticate(request, db)
    authorize(user, 'orders.update_status')
    const order = findOrder(db, request.params.id)
    assertNotFinal(order)

    const status = isRecord(request.body) ? request.body.status : undefined
    // Cancelling is a separate permission; accepting it here would let anyone with
    // `orders.update_status` bypass `orders.cancel`.
    if (status === 'cancelled') {
      const message = 'Use the cancel action to cancel an order.'
      throw new HttpError(422, message, { errors: { status: message } })
    }
    if (!isOrderStatus(status)) {
      throw new HttpError(422, 'Choose a valid status.', {
        errors: { status: 'Choose a valid status.' },
      })
    }

    const allowed = nextStatuses(order.status)
    if (!allowed.includes(status)) {
      const options = allowed.map((next) => STATUS_LABELS[next].toLowerCase()).join(' or ')
      throw new HttpError(409, `A ${order.status} order can only be moved to ${options}.`, {
        code: 'INVALID_TRANSITION',
      })
    }

    order.status = status
    order.updatedAt = new Date().toISOString()
    return [200, toOrder(order, canSeeAmounts(user))]
  })
}

export function cancelOrder(request: MockRequest): MockResponse {
  return updateDb((db) => {
    const user = authenticate(request, db)
    authorize(user, 'orders.cancel')
    const order = findOrder(db, request.params.id)
    assertNotFinal(order)

    order.status = 'cancelled'
    order.updatedAt = new Date().toISOString()
    return [200, toOrder(order, canSeeAmounts(user))]
  })
}
