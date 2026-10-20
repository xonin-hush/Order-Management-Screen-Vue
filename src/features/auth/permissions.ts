/**
 * Every permission the UI can gate. The client checks permissions, never roles: roles are
 * server-side bundles of permissions, so a new role needs no client change.
 */
export const PERMISSIONS = [
  'orders.view',
  'orders.view_amount',
  'orders.create',
  'orders.update',
  'orders.update_status',
  'orders.cancel',
  'admin.access',
] as const

export type Permission = (typeof PERMISSIONS)[number]
