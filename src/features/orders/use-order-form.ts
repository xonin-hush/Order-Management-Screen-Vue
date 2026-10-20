import { computed } from 'vue'
import { revalidateLogic, useForm, type DeepKeys } from '@tanstack/vue-form'
import type { FieldErrors } from '@/api/errors'
import { clearServerError, setServerError, submitForm, toFieldName } from '@/lib/form-field'
import { orderInputSchema, type OrderInput } from './schema'
import type { Order } from './types'

export interface LineItemDraft {
  /** Stable identity for rendering and focus; never sent to the API. */
  key: number
  product: string
  quantity: number | null
  unitPrice: number | null
}

export interface OrderFormValues {
  customer: { name: string; phone: string; address: string }
  items: LineItemDraft[]
}

let nextKey = 1

export function emptyItem(): LineItemDraft {
  return { key: nextKey++, product: '', quantity: 1, unitPrice: null }
}

function toValues(order?: Order): OrderFormValues {
  if (!order) return { customer: { name: '', phone: '', address: '' }, items: [emptyItem()] }
  return {
    customer: { ...order.customer },
    items: order.items.map((item) => ({
      key: nextKey++,
      product: item.product,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? null,
    })),
  }
}

/** The API payload for the form's values (before validation): line items without their keys. */
function toPayload({ customer, items }: OrderFormValues) {
  return {
    customer: { ...customer },
    items: items.map(({ product, quantity, unitPrice }) => ({ product, quantity, unitPrice })),
  }
}

/** Checks with the schema the API uses, so messages and paths are the same as in a 422. */
function validate(values: OrderFormValues) {
  const result = orderInputSchema.safeParse(toPayload(values))
  if (result.success) return undefined
  const fields: Partial<Record<DeepKeys<OrderFormValues>, string>> = {}
  for (const issue of result.error.issues) {
    fields[toFieldName(issue.path) as DeepKeys<OrderFormValues>] ??= issue.message
  }
  return { fields }
}

export function lineTotal({ quantity, unitPrice }: LineItemDraft): number | null {
  return Number.isInteger(quantity) && Number.isInteger(unitPrice) ? quantity! * unitPrice! : null
}

/**
 * The create/edit order form (TanStack Form). It's checked on the first submit, then as the
 * user types. Server errors (422) show under their fields and stay with them, also when an
 * earlier line item is removed, until the field is edited.
 */
export function useOrderForm(
  initial: Order | undefined,
  handlers: { onSubmit: (input: OrderInput) => Promise<void>; onInvalid: () => void },
) {
  const form = useForm({
    defaultValues: toValues(initial),
    validationLogic: revalidateLogic(),
    validators: { onDynamic: ({ value }) => validate(value) },
    listeners: { onChange: clearServerError },
    // What the API takes: trimmed, with the phone number in one format.
    onSubmit: ({ value }) => handlers.onSubmit(orderInputSchema.parse(toPayload(value))),
    onSubmitInvalid: handlers.onInvalid,
  })

  const items = form.useSelector((state) => state.values.items)
  const total = computed(() => items.value.reduce((sum, item) => sum + (lineTotal(item) ?? 0), 0))
  /** Adding and then removing an empty item isn't a change. */
  const isDirty = form.useSelector((state) => !state.isDefaultValue)

  /** Puts a 422's messages under their fields; returns those the form has no field for. */
  function setServerErrors(fieldErrors: FieldErrors): string[] {
    const unplaced: string[] = []
    for (const [path, message] of Object.entries(fieldErrors)) {
      const name = toFieldName(path)
      if (form.getFieldMeta(name as DeepKeys<OrderFormValues>)) setServerError(form, name, message)
      else unplaced.push(message)
    }
    return unplaced
  }

  return { form, items, total, isDirty, submit: () => submitForm(form), setServerErrors }
}
