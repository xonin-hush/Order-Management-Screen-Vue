import type { Customer, OrderStatus } from '@/features/orders/types'
import { createSeedDatabase } from './seed'

export interface OrderItemRecord {
  id: number
  product: string
  quantity: number
  unitPrice: number
}

/** Server-side row. The order amount isn't stored; it's always derived from the items. */
export interface OrderRecord {
  id: number
  number: string
  status: OrderStatus
  customer: Customer
  items: OrderItemRecord[]
  createdAt: string
  updatedAt: string
}

export interface SessionRecord {
  token: string
  userId: number
  createdAt: string
}

export interface MockDatabase {
  version: 1
  orders: OrderRecord[]
  sessions: SessionRecord[]
  nextOrderId: number
  nextItemId: number
}

/**
 * Kept in localStorage and re-read on every request, so data and sessions survive reloads.
 * Bump the key when the shape changes; anything unreadable is replaced with a fresh seed.
 */
const STORAGE_KEY = 'oms.mock-db.v1'

function isDatabase(value: unknown): value is MockDatabase {
  if (typeof value !== 'object' || value === null) return false
  const db = value as Partial<MockDatabase>
  return db.version === 1 && Array.isArray(db.orders) && Array.isArray(db.sessions)
}

function writeDb(db: MockDatabase) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // Storage full or unavailable (e.g. some private modes): keep serving this request.
  }
}

export function readDb(): MockDatabase {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (isDatabase(parsed)) return parsed
  } catch {
    // Corrupt JSON: fall through to a fresh seed.
  }
  const db = createSeedDatabase(new Date())
  writeDb(db)
  return db
}

/** Applies a change to the latest data and persists it, like a transaction. */
export function updateDb<T>(change: (db: MockDatabase) => T): T {
  const db = readDb()
  const result = change(db)
  writeDb(db)
  return result
}

/** Back to the seed orders, keeping sessions so nobody gets signed out. */
export function resetOrders() {
  updateDb((db) => {
    const { orders, nextOrderId, nextItemId } = createSeedDatabase(new Date())
    Object.assign(db, { orders, nextOrderId, nextItemId })
  })
}

export function orderAmount(order: Pick<OrderRecord, 'items'>): number {
  return order.items.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
}
