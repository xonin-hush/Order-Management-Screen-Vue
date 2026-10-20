/** The orders API contract. Monetary values are whole Iraqi dinars (IQD has no minor unit in use). */

export const ORDER_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface Customer {
  name: string
  phone: string
  address: string
}

export interface OrderLineItem {
  id: number
  product: string
  quantity: number
  /** Omitted for users without `orders.view_amount`. */
  unitPrice?: number
}

export interface OrderSummary {
  id: number
  number: string
  customerName: string
  status: OrderStatus
  /** Order total. Omitted for users without `orders.view_amount`. */
  amount?: number
  createdAt: string
}

export interface Order {
  id: number
  number: string
  status: OrderStatus
  customer: Customer
  items: OrderLineItem[]
  /** Order total. Omitted for users without `orders.view_amount`. */
  amount?: number
  createdAt: string
  updatedAt: string
}

export interface OrderFilters {
  /** Customer name or order number; empty means no search. */
  q: string
  /** `null` means all statuses. */
  status: OrderStatus | null
}
