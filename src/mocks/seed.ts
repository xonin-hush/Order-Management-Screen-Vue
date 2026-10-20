import type { OrderStatus } from '@/features/orders/types'
import type { MockDatabase, OrderRecord } from './db'

/** Deterministic demo data (only timestamps depend on `now`), so tests are reproducible. */
const SEED = 20_261_020

const FIRST_NAMES = [
  'Ahmed',
  'Ali',
  'Hussein',
  'Mohammed',
  'Mustafa',
  'Omar',
  'Yousif',
  'Haider',
  'Karrar',
  'Hassan',
  'Zainab',
  'Fatima',
  'Maryam',
  'Noor',
  'Sara',
  'Rusul',
  'Hiba',
  'Aya',
  'Shahad',
  'Dalia',
]
const LAST_NAMES = [
  'Al-Jubouri',
  'Al-Saadi',
  'Al-Hashimi',
  'Kareem',
  'Abbas',
  'Jaber',
  'Al-Tamimi',
  'Hamid',
  'Salman',
  'Al-Obaidi',
  'Mahdi',
  'Al-Khafaji',
  'Aziz',
  'Al-Rubaie',
  'Nasser',
  'Al-Dulaimi',
]
const PLACES = [
  {
    city: 'Baghdad',
    districts: ['Karrada', 'Mansour', 'Adhamiya', 'Zayouna', 'Jadriya', 'Kadhimiya'],
  },
  { city: 'Basra', districts: ['Al-Ashar', 'Al-Jazair', 'Al-Tuwaisa'] },
  { city: 'Erbil', districts: ['Ankawa', 'Bakhtiari', 'Iskan'] },
  { city: 'Najaf', districts: ['Al-Adala', 'Al-Ameer'] },
  { city: 'Karbala', districts: ['Al-Abbasiya', 'Al-Hurr'] },
  { city: 'Mosul', districts: ['Al-Zuhoor', 'Al-Muthanna'] },
  { city: 'Sulaymaniyah', districts: ['Azadi', 'Sarchinar'] },
  { city: 'Kirkuk', districts: ['Rahimawa', 'Al-Wasiti'] },
]
// Iraqi mobile prefixes (Asiacell 077x, Korek 075x, Zain 078x/079x).
const PHONE_PREFIXES = ['0770', '0771', '0772', '0750', '0751', '0780', '0781', '0790']
const PRODUCTS = [
  { product: 'Wireless earbuds', unitPrice: 45_000 },
  { product: 'Phone case', unitPrice: 12_000 },
  { product: 'USB-C charger 65W', unitPrice: 28_000 },
  { product: 'Smart watch', unitPrice: 95_000 },
  { product: 'Bluetooth speaker', unitPrice: 55_000 },
  { product: 'Power bank 20,000 mAh', unitPrice: 35_000 },
  { product: 'Laptop stand', unitPrice: 30_000 },
  { product: 'Mechanical keyboard', unitPrice: 85_000 },
  { product: 'Wireless mouse', unitPrice: 22_000 },
  { product: 'Screen protector', unitPrice: 7_500 },
  { product: 'HDMI cable 2m', unitPrice: 9_000 },
  { product: 'Webcam 1080p', unitPrice: 60_000 },
  { product: 'Portable SSD 1TB', unitPrice: 140_000 },
  { product: 'Noise-cancelling headphones', unitPrice: 210_000 },
  { product: 'Android tablet 10"', unitPrice: 325_000 },
]

const DAY = 24 * 60 * 60 * 1000

/** Small, fast, seedable PRNG (mulberry32). */
function createRandom(seed: number) {
  let state = seed
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1))
  const pick = <T>(list: readonly T[]): T => list[int(0, list.length - 1)]!
  /** `count` distinct entries (Fisher–Yates, so results don't depend on the JS engine's sort). */
  const sample = <T>(list: readonly T[], count: number): T[] => {
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = int(0, i)
      ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy.slice(0, count)
  }
  return { next, int, pick, sample }
}

/** A fixed mix, so every status is well represented; ages follow the workflow. */
const STATUS_MIX: ReadonlyArray<{ status: OrderStatus; count: number; days: [number, number] }> = [
  { status: 'pending', count: 8, days: [0, 2] },
  { status: 'processing', count: 8, days: [0.5, 4] },
  { status: 'shipped', count: 8, days: [2, 9] },
  { status: 'delivered', count: 20, days: [5, 45] },
  { status: 'cancelled', count: 6, days: [1, 40] },
]

export function createSeedDatabase(now: Date): MockDatabase {
  const random = createRandom(SEED)
  let nextItemId = 1

  const drafts = STATUS_MIX.flatMap(({ status, count, days: [min, max] }) =>
    Array.from({ length: count }, () => ({ status, daysAgo: min + random.next() * (max - min) })),
  )
  // Oldest first, so ids and order numbers follow time like a real sequence.
  drafts.sort((a, b) => b.daysAgo - a.daysAgo)

  const orders: OrderRecord[] = drafts.map(({ status, daysAgo }, index) => {
    const id = index + 1
    const place = random.pick(PLACES)
    const created = now.getTime() - daysAgo * DAY
    const lastChange = status === 'pending' ? 0 : random.next() * Math.min(daysAgo, 5) * DAY

    return {
      id,
      number: `ORD-${1000 + id}`,
      status,
      customer: {
        name: `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`,
        phone: `${random.pick(PHONE_PREFIXES)} ${random.int(100, 999)} ${random.int(1000, 9999)}`,
        address: `Street ${random.int(1, 60)}, House ${random.int(1, 120)}, ${random.pick(place.districts)}, ${place.city}`,
      },
      items: random.sample(PRODUCTS, random.int(1, 4)).map(({ product, unitPrice }) => ({
        id: nextItemId++,
        product,
        quantity: random.next() < 0.75 ? 1 : random.int(2, 3),
        unitPrice,
      })),
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(created + lastChange).toISOString(),
    }
  })

  return {
    version: 1,
    orders,
    sessions: [],
    nextOrderId: orders.length + 1,
    nextItemId,
  }
}
