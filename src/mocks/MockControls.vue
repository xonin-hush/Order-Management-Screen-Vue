<script setup lang="ts">
import { computed, useId, useTemplateRef } from 'vue'
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
const armed = computed(() => failure.mode !== 'off')
const descriptionId = useId()

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
    <!-- Keeps Tab inside: opened over a side panel, the panel's focus trap would otherwise pull
         focus back into the panel. -->
    <v-menu location="top start" offset="8" :close-on-content-click="false" retain-focus>
      <template #activator="{ props: activator }">
        <v-btn
          v-bind="activator"
          variant="elevated"
          color="surface"
          rounded="pill"
          :prepend-icon="mdiFlaskOutline"
        >
          Mock API
          <v-chip v-if="armed" color="warning" class="ms-2">Failure armed</v-chip>
        </v-btn>
      </template>

      <!-- Capped at the space above the button; scrolls inside on short screens. -->
      <v-card
        :flat="false"
        :border="false"
        elevation="4"
        class="mock-controls__panel pa-4 d-flex flex-column ga-5"
      >
        <!-- What the failure does goes under the select as text of its own: as the field's hint,
             three lines were squeezed onto Vuetify's 12px message line and clipped. -->
        <div>
          <v-select
            ref="select"
            v-model="mode"
            label="Simulate a failure"
            :items="FAILURE_MODES"
            item-title="label"
            item-value="value"
            :aria-describedby="descriptionId"
            :menu-props="{ onAfterLeave: keepFocus }"
          />
          <v-alert v-if="armed" :id="descriptionId" type="warning" class="mt-3 text-body-small">
            {{ selected.description }} Then it switches itself off. Sign-in is never affected.
          </v-alert>
          <p v-else :id="descriptionId" class="mt-2 text-body-small text-medium-emphasis">
            {{ selected.description }}
          </p>
        </div>

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
/* Above dialogs (2400) too, so failures can be armed with a side panel open; under toasts. */
.mock-controls {
  position: fixed;
  inset-inline-start: 16px;
  bottom: 16px;
  z-index: 2450;
}

/* Where an open panel reaches this corner, stay clear of its footer (total, Save). Global as a
   whole: Vue drops whatever follows a :global() part. */
@media (max-width: 767.98px) {
  :global(body:has(.side-panel.v-overlay--active .side-panel__footer) .mock-controls) {
    bottom: 84px;
  }

  /* And leave room under the panel's content to scroll its end (Add item, Total) clear of this
     button. This file only loads with the mock API, so a real backend's panels are unaffected. */
  :global(body .side-panel__scroll) {
    padding-bottom: 72px;
  }
}

.mock-controls__panel {
  width: min(22rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 5rem);
  overflow-y: auto;
}
</style>
