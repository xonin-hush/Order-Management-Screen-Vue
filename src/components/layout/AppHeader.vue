<script setup lang="ts">
import { computed, ref } from 'vue'
import { type RouteLocationRaw, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { useDisplay } from 'vuetify'
import { mdiLogout } from '@mdi/js'
import { endSession } from '@/features/auth/end-session'
import { useSessionStore } from '@/features/auth/session.store'
import { useNavigationProgress } from '@/lib/navigation-progress'
import BrandMark from './BrandMark.vue'

const session = useSessionStore()
const router = useRouter()
const queryClient = useQueryClient()
const { xs: phone } = useDisplay()
const navigating = useNavigationProgress(router)

// Destinations the user can't open aren't shown at all (see README: hidden vs disabled).
const navigation = computed(() => {
  const items: { label: string; to: RouteLocationRaw }[] = []
  if (session.can('orders.view')) items.push({ label: 'Orders', to: { name: 'orders' } })
  if (session.can('admin.access')) items.push({ label: 'Admin', to: { name: 'admin' } })
  return items
})

const initials = computed(() =>
  (session.user?.name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join(''),
)

const signingOut = ref(false)

async function signOut() {
  signingOut.value = true
  await endSession({ router, queryClient, session }, 'signed-out')
}
</script>

<template>
  <v-app-bar flat border="b" color="surface" height="56">
    <v-container max-width="1280" class="d-flex align-center ga-2 ga-sm-6 px-4 px-sm-6 px-lg-8">
      <RouterLink
        :to="{ name: 'orders' }"
        class="brand-link d-flex align-center ga-2 rounded text-title-medium font-weight-semibold text-high-emphasis text-decoration-none"
      >
        <BrandMark />
        <span :class="{ 'd-sr-only': phone }">OrderDesk</span>
      </RouterLink>

      <nav aria-label="Main" class="d-flex align-center ga-1">
        <v-btn
          v-for="item in navigation"
          :key="item.label"
          :to="item.to"
          variant="text"
          color="secondary"
          active-color="primary"
        >
          {{ item.label }}
        </v-btn>
      </nav>

      <div class="ms-auto d-flex align-center ga-2 ga-sm-3">
        <span v-if="phone" class="d-sr-only">
          Signed in as {{ session.user?.name }}, {{ session.roleLabel }}
        </span>
        <div v-else class="text-end">
          <p class="text-body-medium font-weight-medium">{{ session.user?.name }}</p>
          <p class="text-body-small text-medium-emphasis">{{ session.roleLabel }}</p>
        </div>
        <v-avatar size="32" color="surface-light" class="text-label-medium" aria-hidden="true">
          {{ initials }}
        </v-avatar>
        <v-btn
          v-if="phone"
          :icon="mdiLogout"
          variant="text"
          color="secondary"
          :loading="signingOut"
          aria-label="Sign out"
          @click="signOut"
        />
        <v-btn
          v-else
          :prepend-icon="mdiLogout"
          variant="text"
          color="secondary"
          :loading="signingOut"
          @click="signOut"
        >
          Sign out
        </v-btn>
      </div>
    </v-container>
    <v-progress-linear
      :active="navigating"
      indeterminate
      absolute
      location="bottom"
      height="2"
      color="primary"
      aria-label="Loading page"
    />
  </v-app-bar>
</template>

<style scoped>
/* On a phone the link is just the 28px mark: give touch screens a 44px target around it. */
@media (pointer: coarse) {
  .brand-link {
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
  }
}

/* High-contrast modes drop the tint on the current page's link; mark it as the status filter
   marks its choice. */
@media (forced-colors: active) {
  nav .v-btn[aria-current='page'] {
    forced-color-adjust: none;
    background: Highlight;
    color: HighlightText;
  }
}
</style>
