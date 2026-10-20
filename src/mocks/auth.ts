import type { Permission } from '@/features/auth/permissions'
import { readDb, updateDb, type MockDatabase } from './db'
import { HttpError, isRecord, type MockRequest, type MockResponse } from './http'
import { hasPermission, ROLE_PERMISSIONS, USERS, type MockUser } from './users'

/** Wording for 403 messages: "You don't have permission to {action}." */
const PERMISSION_ACTIONS: Record<Permission, string> = {
  'orders.view': 'view orders',
  'orders.view_amount': 'see order amounts',
  'orders.create': 'create orders',
  'orders.update': 'edit orders',
  'orders.update_status': 'change order statuses',
  'orders.cancel': 'cancel orders',
  'admin.access': 'open the admin area',
}

/** Identifies the caller from the bearer token; a missing or unknown token is a 401. */
export function authenticate(request: MockRequest, db: MockDatabase): MockUser {
  const session = db.sessions.find((candidate) => candidate.token === request.token)
  const user = session && USERS.find((candidate) => candidate.id === session.userId)
  if (!user) throw new HttpError(401, 'Your session has expired. Please sign in again.')
  return user
}

export function authorize(user: MockUser, permission: Permission) {
  if (!hasPermission(user, permission)) {
    throw new HttpError(403, `You don't have permission to ${PERMISSION_ACTIONS[permission]}.`)
  }
}

/** Opaque random token. (`crypto.randomUUID` needs a secure context, which breaks LAN testing.) */
function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function login({ body }: MockRequest): MockResponse {
  const { email, password } = isRecord(body) ? body : {}
  const errors: Record<string, string> = {}
  if (typeof email !== 'string' || !email.trim()) errors.email = 'Enter your email address.'
  if (typeof password !== 'string' || !password) errors.password = 'Enter your password.'
  if (typeof email !== 'string' || typeof password !== 'string' || Object.keys(errors).length) {
    throw new HttpError(422, 'Enter your email and password.', { errors })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const user = USERS.find(
    (candidate) => candidate.email === normalizedEmail && candidate.password === password,
  )
  if (!user) throw new HttpError(401, 'Incorrect email or password.')

  const token = createToken()
  updateDb((db) => {
    db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() })
  })
  return [200, { token }]
}

/** Revokes the token. Idempotent, so signing out never fails. */
export function logout({ token }: MockRequest): MockResponse {
  updateDb((db) => {
    db.sessions = db.sessions.filter((session) => session.token !== token)
  })
  return [204]
}

export function me(request: MockRequest): MockResponse {
  const user = authenticate(request, readDb())
  return [
    200,
    {
      id: user.id,
      name: user.name,
      role: user.role,
      permissions: [...ROLE_PERMISSIONS[user.role]],
    },
  ]
}
