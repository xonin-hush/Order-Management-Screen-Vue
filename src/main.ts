import '@fontsource-variable/inter'
// Vuetify's styles without its palette classes (bg-red-lighten-2…): colours come from the theme.
import 'vuetify/styles/core'
import 'vuetify/styles/utilities'
import './assets/main.css'

import { createApp, type Component } from 'vue'
import { createWebHistory } from 'vue-router'
import App from './App.vue'
import { http } from './api/http'
import { createAppContext } from './app/context'
import type { DemoAccount } from './features/auth/types'

async function bootstrap() {
  let demoAccounts: DemoAccount[] = []
  let devTools: Component | undefined

  // Installed before the app starts, so the first request (restoring the session) is handled.
  // A separate chunk, never loaded by a build pointed at a real API.
  if (!import.meta.env.VITE_API_BASE_URL) {
    const { installMockApi, DEMO_ACCOUNTS, MockControls } = await import('./mocks')
    installMockApi(http)
    demoAccounts = DEMO_ACCOUNTS
    devTools = MockControls
  }

  const context = createAppContext({
    history: createWebHistory(import.meta.env.BASE_URL),
    demoAccounts,
    devTools,
  })
  createApp(App).use(context).mount('#app')
}

void bootstrap()
