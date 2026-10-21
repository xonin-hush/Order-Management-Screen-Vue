<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { mdiClose, mdiFlaskOutline } from '@mdi/js'
import { confirmAction } from '@/components/ui/confirm'
import { useSessionStore } from '@/features/auth/session.store'
import { notifySuccess } from '@/lib/notify'
import { resetOrders } from './db'
import { armFailure, failure, FAILURE_MODES, type FailureMode } from './failures'

/** Demo tooling, only on the mock API: simulate failures, see your permissions, reset data. */
const session = useSessionStore()
const queryClient = useQueryClient()

const open = ref(false)
const titleId = useId()
const failureHeadingId = useId()

// Picking a failure arms it for the next matching request(s); it switches itself off after.
const mode = computed({
  get: () => failure.mode,
  set: (value: FailureMode) => armFailure(value),
})
const armed = computed(() => failure.mode !== 'off')

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
    <v-menu
      v-model="open"
      location="top start"
      offset="8"
      :close-on-content-click="false"
      retain-focus
    >
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

      <!-- Capped at the space above the button. On short screens the middle scrolls, between a
           header and footer that stay put. A non-modal dialog: titled, with its own controls,
           and the page behind it stays usable. -->
      <v-card
        role="dialog"
        :aria-labelledby="titleId"
        :flat="false"
        :border="false"
        elevation="4"
        class="mock-controls__panel"
      >
        <!-- A title, and a way out on touch screens, where Escape isn't to hand. -->
        <div class="d-flex align-start ga-3 px-4 pt-4">
          <div class="flex-grow-1 min-w-0">
            <h2 :id="titleId" class="text-title-medium font-weight-semibold">Mock API</h2>
            <p class="text-body-small text-medium-emphasis">
              A stand-in backend, running in your browser.
            </p>
          </div>
          <v-btn
            :icon="mdiClose"
            variant="text"
            size="small"
            density="comfortable"
            aria-label="Close"
            class="me-n2 mt-n1"
            @click="open = false"
          />
        </div>

        <div class="mock-controls__body d-flex flex-column ga-5 pa-4">
          <!-- Every failure in view with what it does, armed in one click: a select hid both
               behind a second popup. -->
          <section>
            <h3 :id="failureHeadingId" class="section-title">Simulate a failure</h3>
            <v-radio-group
              v-model="mode"
              :aria-labelledby="failureHeadingId"
              density="compact"
              hide-details
              class="mt-2"
            >
              <v-radio
                v-for="option in FAILURE_MODES"
                :key="option.value"
                :value="option.value"
                :label="option.label"
                :description="option.description"
              />
            </v-radio-group>
            <p class="mt-3 text-body-small text-medium-emphasis">
              Loads fail twice, to get past their one automatic retry. A failure switches itself off
              once it has happened, and sign-in is never affected.
            </p>
          </section>

          <section v-if="session.user">
            <h3 class="section-title">
              Permissions
              <span class="font-weight-regular text-medium-emphasis">from GET /me</span>
            </h3>
            <ul class="mt-2 d-flex flex-wrap ga-1">
              <li v-for="permission in session.user.permissions" :key="permission">
                <v-chip label
                  ><code>{{ permission }}</code></v-chip
                >
              </li>
            </ul>
          </section>
        </div>

        <div class="d-flex align-center justify-space-between ga-3 border-t px-4 py-3">
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

/* Touch screens' 44px buttons make the footer, and this button, 8px taller. */
@media (max-width: 767.98px) and (pointer: coarse) {
  :global(body:has(.side-panel.v-overlay--active .side-panel__footer) .mock-controls) {
    bottom: 92px;
  }

  :global(body .side-panel__scroll) {
    padding-bottom: 80px;
  }
}

.mock-controls__panel {
  display: flex;
  flex-direction: column;
  width: min(24rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 5rem);
}

.mock-controls__body {
  min-height: 0;
  overflow-y: auto;
}

/* Vuetify sets options at 16px and their descriptions at body size; at the panel's own sizes all
   six fit above the button. */
.mock-controls__panel :deep(.v-selection-control .v-label) {
  font-size: 0.875rem;
  letter-spacing: normal;
}

.mock-controls__panel :deep(.v-selection-control__description) {
  font-size: 0.75rem;
  line-height: 1rem;
  letter-spacing: normal;
}

.mock-controls__panel :deep(.v-selection-control-group) {
  gap: 4px;
}
</style>
