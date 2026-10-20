import { http } from '@/api/http'
import type { Credentials, CurrentUser } from './types'

export async function requestToken(credentials: Credentials): Promise<string> {
  const { data } = await http.post<{ token: string }>('/auth/login', credentials)
  return data.token
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const { data } = await http.get<CurrentUser>('/me')
  return data
}

/** Revokes a token server-side. Takes the token explicitly: by now it's no longer the session's. */
export async function revokeToken(token: string): Promise<void> {
  await http.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } })
}
