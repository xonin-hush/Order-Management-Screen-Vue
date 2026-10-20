<script setup lang="ts">
import { inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { devToolsKey } from '@/app/dev-tools'
import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost.vue'
import { useSessionSync } from '@/features/auth/session-sync'
import { useSessionStore } from '@/features/auth/session.store'
import { notifications, notificationsGeneration } from '@/lib/notify'
import { useRouteFocus } from '@/lib/route-focus'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()
const devTools = inject(devToolsKey, null)

const routerReady = ref(false)
void router.isReady().then(() => {
  routerReady.value = true
})

useRouteFocus(router)
useSessionSync()

// Permissions were re-read after a 403: re-run the guards on the current page.
watch(
  () => session.user,
  (user, previous) => {
    if (user && previous && user !== previous) {
      void router.replace({ path: route.path, query: route.query, hash: route.hash, force: true })
    }
  },
)
</script>

<template>
  <v-app>
    <div v-if="!routerReady" role="status" class="d-flex align-center justify-center h-screen">
      <v-progress-circular indeterminate size="24" width="2" color="secondary" />
      <span class="d-sr-only">Loading OrderDesk…</span>
    </div>

    <RouterView v-else />

    <component :is="devTools" v-if="devTools && routerReady" />
    <ConfirmDialogHost />
    <!-- Like Vuetify's tooltips, toasts stay out of the overlay stack, so Escape still closes the
         dialog the user is in rather than the toast; z-index keeps them above dialogs (2400). -->
    <v-snackbar-queue
      :key="notificationsGeneration"
      v-model="notifications"
      location="bottom end"
      closable
      :total-visible="3"
      :z-index="2500"
      :_disable-global-stack="true"
    />
  </v-app>
</template>
