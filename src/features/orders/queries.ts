import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/vue-query'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { isApiError } from '@/api/errors'
import {
  cancelOrder,
  changeOrderStatus,
  createOrder,
  fetchOrder,
  fetchOrders,
  updateOrder,
} from './api'
import type { OrderInput } from './schema'
import type { Order, OrderFilters, OrderStatus, OrderSummary } from './types'

/** Query keys in one place, so invalidation after a write can target exactly what changed. */
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters) => [...orderKeys.lists(), filters] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: number) => [...orderKeys.details(), id] as const,
}

/**
 * Each filter combination is its own cache entry, so a slow response for an older search can't
 * overwrite a newer one. Previous results stay on screen while new ones load.
 */
export function useOrdersQuery(filters: MaybeRefOrGetter<OrderFilters>) {
  return useQuery({
    queryKey: computed(() => orderKeys.list(toValue(filters))),
    queryFn: ({ queryKey: [, , keyFilters], signal }) => fetchOrders(keyFilters, signal),
    placeholderData: keepPreviousData,
  })
}

export function useOrderQuery(id: MaybeRefOrGetter<number>) {
  return useQuery({
    queryKey: computed(() => orderKeys.detail(toValue(id))),
    queryFn: ({ queryKey: [, , orderId], signal }) => fetchOrder(orderId, signal),
  })
}

/** What the list already knows about an order, so a panel can show its number right away. */
export function findCachedSummary(queryClient: QueryClient, id: number): OrderSummary | undefined {
  for (const [, orders] of queryClient.getQueriesData<OrderSummary[]>({
    queryKey: orderKeys.lists(),
  })) {
    const match = orders?.find((order) => order.id === id)
    if (match) return match
  }
  return undefined
}

/**
 * After a write, store the returned order and refetch every list (rather than patch them):
 * the change may move the order in or out of a filter.
 */
function useOrderWriteHandlers() {
  const queryClient = useQueryClient()
  return {
    onSuccess(order: Order) {
      queryClient.setQueryData(orderKeys.detail(order.id), order)
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
    onError(error: unknown, { id }: { id: number }) {
      // The order changed or disappeared meanwhile: show its current state instead of ours.
      if (isApiError(error, 'conflict') || isApiError(error, 'not_found')) {
        void queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
        void queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      }
    },
  }
}

export function useChangeOrderStatus() {
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      changeOrderStatus(id, status),
    ...useOrderWriteHandlers(),
  })
}

export function useCancelOrder() {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => cancelOrder(id),
    ...useOrderWriteHandlers(),
  })
}

export function useCreateOrder() {
  const { onSuccess } = useOrderWriteHandlers()
  return useMutation({ mutationFn: (input: OrderInput) => createOrder(input), onSuccess })
}

export function useUpdateOrder() {
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: OrderInput }) => updateOrder(id, input),
    ...useOrderWriteHandlers(),
  })
}
