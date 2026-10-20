<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { errorMessage } from '@/api/errors'
import ErrorState from '@/components/ui/ErrorState.vue'
import { safeRedirect } from '@/lib/navigation'
import { endSession } from './end-session'
import { useSessionStore } from './session.store'

/**
 * GET /me failed for a reason other than 401 (offline, server down). Don't sign the user out
 * over a network blip, and don't let them in either: offer "Try again" and "Sign out".
 */
const session = useSessionStore()
const router = useRouter()
const route = useRoute()
const queryClient = useQueryClient()
const retrying = ref(false)

async function retry() {
  retrying.value = true
  try {
    await session.retry()
    // The guard decides where that leads: the page they wanted, "no access", or sign-in.
    if (session.status !== 'unavailable') {
      await router.replace(safeRedirect(route.query.redirect) ?? { name: 'orders' })
    }
  } finally {
    retrying.value = false
  }
}

function signOut() {
  return endSession({ router, queryClient, session }, 'signed-out')
}
</script>

<template>
  <v-main>
    <div class="centered-page">
      <ErrorState
        as="h1"
        title="We couldn't load your account"
        :description="errorMessage(session.unavailableReason)"
        :retrying="retrying"
        @retry="retry"
      >
        <template #actions>
          <v-btn variant="text" @click="signOut">Sign out</v-btn>
        </template>
      </ErrorState>
    </div>
  </v-main>
</template>
