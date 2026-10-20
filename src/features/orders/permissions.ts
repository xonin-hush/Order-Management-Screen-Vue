import type { Permission } from '@/features/auth/permissions'

/**
 * Orders carry prices, so creating or editing one also needs permission to see amounts.
 * Shared by the routes, the UI and the mock API.
 */
export const CREATE_ORDER_PERMISSIONS: readonly Permission[] = [
  'orders.create',
  'orders.view_amount',
]
export const EDIT_ORDER_PERMISSIONS: readonly Permission[] = ['orders.update', 'orders.view_amount']
