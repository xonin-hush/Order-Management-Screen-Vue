import type { AnyFieldApi, AnyFormApi } from '@tanstack/vue-form'

/**
 * The message to show under a field: its first error, once the field has been submitted or
 * edited. A line item added after a failed submit isn't flagged before the user gets to it.
 */
export function fieldError(field: AnyFieldApi): string | undefined {
  const { isTouched, errors } = field.state.meta
  if (!isTouched) return undefined
  const [first] = errors as unknown[]
  // Our validators return strings; a zod schema used directly returns issues.
  return typeof first === 'string' ? first : (first as { message?: string } | undefined)?.message
}

/** Binds a TanStack Form field to a Vuetify input: value, changes and error state. */
export function bindField(field: AnyFieldApi) {
  const error = fieldError(field)
  return {
    modelValue: field.state.value,
    'onUpdate:modelValue': field.handleChange,
    errorMessages: error,
    'aria-invalid': error ? true : undefined,
  }
}

/** Shows server errors (e.g. a 422's) under fields until each field is edited. */
export function setServerError(form: AnyFormApi, name: string, message: string | undefined) {
  form.setFieldMeta(name, (meta) => ({
    ...meta,
    errorMap: { ...meta.errorMap, onServer: message },
  }))
}

/** A field's server error is about the value it had; editing the field answers it. */
export function clearServerError({ fieldApi }: { fieldApi: AnyFieldApi }) {
  if (fieldApi.state.meta.errorMap.onServer !== undefined) {
    setServerError(fieldApi.form, fieldApi.name, undefined)
  }
}

export function clearServerErrors(form: AnyFormApi) {
  for (const [name, meta] of Object.entries(form.state.fieldMeta)) {
    if (meta?.errorMap.onServer !== undefined) setServerError(form, name, undefined)
  }
}

/**
 * Submits (again). Server errors are about the previous attempt and the server checks the
 * values anew, so they don't block it.
 */
export function submitForm(form: AnyFormApi) {
  clearServerErrors(form)
  return form.handleSubmit()
}

/** API field paths as form field names: `items.0.quantity` → `items[0].quantity`. */
export function toFieldName(path: string | readonly PropertyKey[]): string {
  const parts = typeof path === 'string' ? path.split('.') : path.map(String)
  return parts.reduce((name, part) => {
    if (part !== '' && Number.isInteger(Number(part))) return `${name}[${part}]`
    return name ? `${name}.${part}` : part
  }, '')
}
