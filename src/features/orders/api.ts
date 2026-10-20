import { http } from '@/api/http'
import type { OrderInput } from './schema'
import type { Order, OrderFilters, OrderStatus, OrderSummary } from './types'

export async function fetchOrders(filters: OrderFilters, signal?: AbortSignal) {
  const { data } = await http.get<OrderSummary[]>('/orders', {
    // Empty filters are left out rather than sent as `q=&status=`.
    params: { q: filters.q || undefined, status: filters.status ?? undefined },
    signal,
  })
  return data
}

export async function fetchOrder(id: number, signal?: AbortSignal) {
  const { data } = await http.get<Order>(`/orders/${id}`, { signal })
  return data
}

export async function changeOrderStatus(id: number, status: OrderStatus) {
  const { data } = await http.patch<Order>(`/orders/${id}/status`, { status })
  return data
}

export async function cancelOrder(id: number) {
  const { data } = await http.post<Order>(`/orders/${id}/cancel`)
  return data
}

export async function createOrder(input: OrderInput) {
  const { data } = await http.post<Order>('/orders', input)
  return data
}

export async function updateOrder(id: number, input: OrderInput) {
  const { data } = await http.put<Order>(`/orders/${id}`, input)
  return data
}
