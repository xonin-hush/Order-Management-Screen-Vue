<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import type { VSelect } from 'vuetify/components'
import { mdiFlaskOutline } from '@mdi/js'
import { confirmAction } from '@/components/ui/confirm'
import { useSessionStore } from '@/features/auth/session.store'
import { notifySuccess } from '@/lib/notify'
import { resetOrders } from './db'
import { armFailure, failure, FAILURE_MODES, type FailureMode } from './failures'

/** Demo tooling, only on the mock API: simulate failures, see your permissions, reset data. */
const session = useSessionStore()
const queryClient = useQueryClient()

// Picking a failure arms it for the next matching request(s); it switches itself off after.
const mode = computed({
  get: () => failure.mode,
  set: (value: FailureMode) => armFailure(value),
})
const selected = computed(() => FAILURE_MODES.find((option) => option.value === failure.mode)!)

// Vuetify 4.3 leaves focus on <body> after an option is picked with the keyboard (the list is
// removed with focus inside it); put it back on the select, where the user was.
const select = useTemplateRef<VSelect>('select')
function keepFocus() {
  if (document.activeElement === document.body) select.value?.focus()
}

async function resetData() {
  const confirmed = await confirmAction({
    title: 'Reset demo data?',
    description: 'All orders go back to the original 50; changes you made are lost.',
    confirmLabel: 'Reset data',
    cancelLabel: 'Keep my changes',
    tone: 'danger',
  })
  if (!confirmed) return
  resetOrders()
  await queryClient.invalidateQueries()
  notifySuccess('Demo data reset')
}
</script>

<template>
  <div class="mock-controls">
    <v-menu location="top start" offset="8" :close-on-content-click="false">
      <template #activator="{ props: activator }">
        <v-btn
          v-bind="activator"
          variant="elevated"
          color="surface"
          rounded="pill"
          :prepend-icon="mdiFlaskOutline"
        >
          Mock API
          <v-chip v-if="failure.mode !== 'off'" color="warning" class="ms-2">Failure armed</v-chip>
        </v-btn>
      </template>

      <!-- Capped at the space above the button; scrolls inside on short screens. -->
      <v-card
        :flat="false"
        :border="false"
        elevation="4"
        class="mock-controls__panel pa-4 d-flex flex-column ga-5"
      >
        <v-select
          ref="select"
          v-model="mode"
          label="Simulate a failure"
          :items="FAILURE_MODES"
          item-title="label"
          item-value="value"
          :hint="`${selected.description}${failure.mode === 'off' ? '' : ' Then it switches itself off. Sign-in is never affected.'}`"
          persistent-hint
          :menu-props="{ onAfterLeave: keepFocus }"
        />

        <div v-if="session.user">
          <p class="text-body-medium font-weight-medium">Permissions from GET /me</p>
          <ul class="mt-2 d-flex flex-wrap ga-1">
            <li v-for="permission in session.user.permissions" :key="permission">
              <v-chip label
                ><code>{{ permission }}</code></v-chip
              >
            </li>
          </ul>
        </div>

        <div class="d-flex align-center justify-space-between ga-3 border-t pt-4">
          <p class="text-body-small text-medium-emphasis">
            Responses take <span class="text-no-wrap">300–1000 ms</span>.
          </p>
          <v-btn size="small" @click="resetData">Reset demo data</v-btn>
        </div>
      </v-card>
    </v-menu>
  </div>
</template>

<style scoped>
.mock-controls {
  position: fixed;
  inset-inline-start: 16px;
  bottom: 16px;
  z-index: 1004;
}

.mock-controls__panel {
  width: min(22rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 5rem);
  overflow-y: auto;
}
</style>
