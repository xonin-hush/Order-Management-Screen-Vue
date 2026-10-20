import type { InjectionKey } from 'vue'
import type { DemoAccount } from './types'

/**
 * Provided only when the app runs against the mock API, so the sign-in page can offer one-click
 * test accounts without importing anything from the mock.
 */
export const demoAccountsKey: InjectionKey<DemoAccount[]> = Symbol('demo-accounts')
