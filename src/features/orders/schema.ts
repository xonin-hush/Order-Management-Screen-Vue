import { z } from 'zod'
import { parseIraqiMobile } from '@/lib/phone'

/**
 * The create/edit order contract, used by both the form and the mock API, so its issue paths
 * are exactly the field paths of a 422 response (`items.0.quantity`).
 */

export const MAX_QUANTITY = 1_000
export const MAX_UNIT_PRICE = 100_000_000
export const MAX_ITEMS = 50

/** Empty fields and unreadable numbers get different, actionable messages. */
const numberRequired = (missing: string, unreadable: string) =>
  z.number({
    error: (issue) => (issue.input === null || issue.input === undefined ? missing : unreadable),
  })

const orderItemSchema = z.object({
  product: z
    .string()
    .trim()
    .min(1, 'Enter a product name.')
    .max(100, 'Keep the product name under 100 characters.'),
  quantity: numberRequired('Enter a quantity.', 'Enter a whole number, like 2.')
    .int('Use a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(MAX_QUANTITY, `Quantity can't be more than ${MAX_QUANTITY.toLocaleString('en')}.`),
  unitPrice: numberRequired('Enter a unit price.', 'Enter whole dinars, like 25,000.')
    .int('Use a whole number of dinars.')
    .min(1, 'Unit price must be more than 0.')
    .max(MAX_UNIT_PRICE, 'That unit price looks too high.'),
})

export const orderInputSchema = z.object({
  customer: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Enter the customer's full name.")
      .max(100, 'Keep the name under 100 characters.'),
    phone: z.string().transform((value, context) => {
      const phone = parseIraqiMobile(value)
      // Every number is stored in the same readable shape: 0770 123 4567.
      if (phone) return phone.formatNational()
      context.addIssue({
        code: 'custom',
        message: 'Enter a valid Iraqi mobile number, e.g. 0770 123 4567.',
      })
      return z.NEVER
    }),
    address: z
      .string()
      .trim()
      .min(5, 'Enter the delivery address.')
      .max(200, 'Keep the address under 200 characters.'),
  }),
  items: z
    .array(orderItemSchema)
    .min(1, 'Add at least one item.')
    .max(MAX_ITEMS, `An order can have at most ${MAX_ITEMS} items.`),
})

/** What the API accepts (after trimming and phone normalisation). */
export type OrderInput = z.output<typeof orderInputSchema>

/** Flattens zod issues to `{ "items.0.quantity": "message" }`, first message per field. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    errors[issue.path.map(String).join('.')] ??= issue.message
  }
  return errors
}
