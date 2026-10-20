/** `GET /me`. Role names and permission lists are owned by the server. */
export interface CurrentUser {
  id: number
  name: string
  role: string
  /** Kept as strings: permissions this client doesn't know yet are simply ignored. */
  permissions: string[]
}

export interface Credentials {
  email: string
  password: string
}

/** Test accounts offered on the sign-in page when running against the mock API. */
export interface DemoAccount {
  role: string
  email: string
  password: string
}
