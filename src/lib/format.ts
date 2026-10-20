/** Fixed English locale; times in the user's own time zone. */

const money = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'IQD',
  // Dinar amounts are whole numbers in practice (fils aren't used).
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

/** 1250000 → "IQD 1,250,000" */
export function formatMoney(amount: number): string {
  return money.format(amount)
}

/** "18 Oct 2026, 14:32" */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
}

/** "Today, 14:32", "Yesterday, 09:05" or "18 Oct 2026": recent orders need the time of day. */
export function formatRelativeDate(iso: string, now = new Date()): string {
  const value = new Date(iso)
  const days = Math.round((startOfDay(now) - startOfDay(value)) / 86_400_000)
  if (days === 0) return `Today, ${time.format(value)}`
  if (days === 1) return `Yesterday, ${time.format(value)}`
  return date.format(value)
}
