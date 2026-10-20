import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import type { App, Component } from 'vue'
import type { RouterHistory } from 'vue-router'
import { configureHttp } from '@/api/http'
import { devToolsKey } from '@/app/dev-tools'
import { demoAccountsKey } from '@/features/auth/demo-accounts'
import { endSession } from '@/features/auth/end-session'
import { useSessionStore } from '@/features/auth/session.store'
import type { DemoAccount } from '@/features/auth/types'
import { createQueryClient } from '@/lib/query-client'
import { createAppVuetify } from '@/plugins/vuetify'
import { createAppRouter } from '@/router'

export interface AppContextOptions {
  history: RouterHistory
  /** Offered on the sign-in page; only provided when running against the mock API. */
  demoAccounts?: DemoAccount[]
  /** Rendered on every page, e.g. the mock API's controls. */
  devTools?: Component
}

/**
 * Wires the router, Pinia, query client, Vuetify and HTTP hooks. Used by `main.ts` and the
 * tests alike.
 */
export function createAppContext({ history, demoAccounts = [], devTools }: AppContextOptions) {
  const pinia = createPinia()
  const queryClient = createQueryClient()
  const vuetify = createAppVuetify()
  const router = createAppRouter(history, pinia)
  const session = () => useSessionStore(pinia)

  configureHttp({
    getToken: () => session().token,
    onUnauthorized: () => {
      // Only a signed-in session can expire; while restoring, the router guard decides.
      if (session().isAuthenticated) {
        void endSession({ router, queryClient, session: session() }, 'expired')
      }
    },
    onForbidden: () => {
      if (session().isAuthenticated) void session().refreshUser()
    },
  })

  return {
    pinia,
    queryClient,
    router,
    install(app: App) {
      app.use(pinia).use(router).use(vuetify).use(VueQueryPlugin, { queryClient })
      app.provide(demoAccountsKey, demoAccounts)
      if (devTools) app.provide(devToolsKey, devTools)
    },
  }
}
