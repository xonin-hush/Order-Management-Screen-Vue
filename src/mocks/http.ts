/** Minimal request/response model the mock route handlers work with. */

export interface MockRequest {
  method: string
  /** Path without base URL or query string, e.g. `/orders/12`. */
  path: string
  /** Path parameters, e.g. `{ id: '12' }` for `/orders/:id`. */
  params: Record<string, string>
  query: Record<string, unknown>
  body: unknown
  /** Bearer token from the Authorization header. */
  token: string | null
}

export type MockResponse = [status: number, body?: unknown]

/** Thrown by handlers to answer with an error, e.g. `throw new HttpError(404, 'Not found.')`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: { code?: string; errors?: Record<string, string> } = {},
  ) {
    super(message)
  }

  toResponse(): MockResponse {
    return [this.status, { message: this.message, ...this.details }]
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
