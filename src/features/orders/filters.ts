import type { LocationQuery } from 'vue-router'
import { isOrderStatus } from './domain'
import type { Order, OrderFilters } from './types'

function firstValue(value: LocationQuery[string] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return first ?? undefined
}

/** Filters live in the URL (`?q=…&status=…`). Unknown statuses are ignored. */
export function readFilters(query: LocationQuery): OrderFilters {
  const status = firstValue(query.status)
  return {
    q: firstValue(query.q)?.trim() ?? '',
    status: isOrderStatus(status) ? status : null,
  }
}

/** Whether an order would appear in a list with these filters (mirrors the API's matching). */
export function matchesFilters(order: Order, { q, status }: OrderFilters): boolean {
  if (status && order.status !== status) return false
  const search = q.toLowerCase()
  return (
    !search ||
    order.customer.name.toLowerCase().includes(search) ||
    order.number.toLowerCase().includes(search)
  )
}
