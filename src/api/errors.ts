import { AxiosError, isCancel } from 'axios'

/** What went wrong, as the UI sees it: screens branch on `kind` and `code`, not HTTP status. */
export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'unknown'

/** Server-side validation messages keyed by field path, e.g. `items.0.quantity`. */
export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  override readonly name = 'ApiError'

  constructor(
    readonly kind: ApiErrorKind,
    /** Safe to show to the user. */
    message: string,
    readonly status?: number,
    /** Stable machine-readable reason, e.g. `ORDER_FINAL`. */
    readonly code?: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message)
  }
}

const KIND_BY_STATUS: Partial<Record<number, ApiErrorKind>> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  422: 'validation',
}

const FALLBACK_MESSAGES: Record<ApiErrorKind, string> = {
  network: "We couldn't reach the server. Check your connection and try again.",
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: "You don't have permission to do that.",
  not_found: "We couldn't find what you were looking for.",
  conflict: 'This was changed in the meantime. Refresh and try again.',
  validation: 'Some details need your attention.',
  server: 'Something went wrong on our side. Please try again in a moment.',
  unknown: 'Something went wrong. Please try again.',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readFieldErrors(value: unknown): FieldErrors {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )
}

export function toApiError(error: AxiosError): ApiError {
  const { response } = error
  if (!response) return new ApiError('network', FALLBACK_MESSAGES.network)

  const { status } = response
  const kind = KIND_BY_STATUS[status] ?? (status >= 500 ? 'server' : 'unknown')
  const body = isRecord(response.data) ? response.data : {}
  // Server messages are written for users; 5xx bodies may leak internals, so use our own copy.
  const serverMessage = kind !== 'server' && typeof body.message === 'string' ? body.message : ''
  const code = typeof body.code === 'string' ? body.code : undefined

  return new ApiError(
    kind,
    serverMessage || FALLBACK_MESSAGES[kind],
    status,
    code,
    readFieldErrors(body.errors),
  )
}

export function isApiError(error: unknown, kind?: ApiErrorKind): error is ApiError {
  return error instanceof ApiError && (kind === undefined || error.kind === kind)
}

/** Requests superseded by newer ones (or by a sign-out) aren't failures the user should see. */
export function isCancellation(error: unknown): boolean {
  return isCancel(error)
}

/** A user-facing sentence for any error. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : FALLBACK_MESSAGES.unknown
}
