import type { Permission } from '@/features/auth/permissions'
import type { DemoAccount } from '@/features/auth/types'

export type Role = 'admin' | 'manager' | 'support'

/** Who can do what. A new role is a new entry here; the client only sees `GET /me`'s list. */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'orders.view',
    'orders.view_amount',
    'orders.create',
    'orders.update',
    'orders.update_status',
    'orders.cancel',
    'admin.access',
  ],
  manager: [
    'orders.view',
    'orders.view_amount',
    'orders.create',
    'orders.update',
    'orders.update_status',
  ],
  support: ['orders.view'],
}

export interface MockUser {
  id: number
  name: string
  email: string
  password: string
  role: Role
}

export const DEMO_PASSWORD = 'password123'

export const USERS: readonly MockUser[] = [
  {
    id: 1,
    name: 'Layla Hassan',
    email: 'admin@example.com',
    password: DEMO_PASSWORD,
    role: 'admin',
  },
  {
    id: 2,
    name: 'Sara Ali',
    email: 'manager@example.com',
    password: DEMO_PASSWORD,
    role: 'manager',
  },
  {
    id: 3,
    name: 'Yusuf Kareem',
    email: 'support@example.com',
    password: DEMO_PASSWORD,
    role: 'support',
  },
]

export const DEMO_ACCOUNTS: DemoAccount[] = USERS.map(({ role, email, password }) => ({
  role,
  email,
  password,
}))

export function hasPermission(user: MockUser, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role].includes(permission)
}
