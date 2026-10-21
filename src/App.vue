<script setup lang="ts">
import { inject, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { devToolsKey } from '@/app/dev-tools'
import BrandMark from '@/components/layout/BrandMark.vue'
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
    <!-- Restoring the session takes up to a second. Fades in late, so a fast start doesn't flash. -->
    <div v-if="!routerReady" role="status" class="boot centered-page">
      <div class="boot__content d-flex flex-column align-center ga-5" aria-hidden="true">
        <BrandMark :size="44" />
        <v-progress-linear indeterminate rounded height="3" color="primary" class="boot__bar" />
      </div>
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

<style scoped>
.boot__content {
  animation: boot-in 240ms ease-out 300ms both;
}

.boot__bar {
  width: 6rem;
}

@keyframes boot-in {
  from {
    opacity: 0;
  }
}
</style>
