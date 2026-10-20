import { ORDER_STATUSES, type OrderStatus } from './types'

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (ORDER_STATUSES as readonly unknown[]).includes(value)
}

/** Order workflow rules, shared by the UI and the mock API so the two can't drift apart. */
export const STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['processing'],
  processing: ['shipped'],
  shipped: ['delivered'],
  delivered: [],
  // Cancelling has its own endpoint and permission (`orders.cancel`), so it's not a transition.
  cancelled: [],
}

/** Delivered and cancelled orders can't be edited, re-statused or cancelled — by anyone. */
const FINAL_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled']

export function isFinal(status: OrderStatus): boolean {
  return FINAL_STATUSES.includes(status)
}

export function nextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return STATUS_TRANSITIONS[status]
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
