import type { Component, InjectionKey } from 'vue'

/**
 * Optional developer tooling rendered by App (the mock API's controls). Injected rather than
 * imported, so builds pointed at a real backend never include it.
 */
export const devToolsKey: InjectionKey<Component> = Symbol('dev-tools')
