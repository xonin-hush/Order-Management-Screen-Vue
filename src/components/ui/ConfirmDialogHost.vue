<script setup lang="ts">
import { computed, onUnmounted, shallowRef, useId, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { VBtn, VCard } from 'vuetify/components'
import { pendingConfirmation, settleConfirmation, type ConfirmOptions } from './confirm'

const route = useRoute()
const open = computed(() => pendingConfirmation.value !== null)

// Kept after answering, so the dialog doesn't go blank while it animates away.
const options = shallowRef<ConfirmOptions>()
watch(pendingConfirmation, (pending) => {
  if (pending) options.value = pending.options
})
const titleId = useId()
const descriptionId = useId()

// A question about the previous screen is meaningless once we've left it (e.g. a 401 redirect).
watch(
  () => route.fullPath,
  () => settleConfirmation(false),
)
onUnmounted(() => settleConfirmation(false))

const card = useTemplateRef<VCard>('card')
const safeChoice = useTemplateRef<VBtn>('safeChoice')

// Opened programmatically, so there's no trigger to return focus to: remember it here.
let returnTo: HTMLElement | null = null
watch(open, (isOpen) => {
  if (isOpen) returnTo = document.activeElement as HTMLElement | null
})

/** Start on the safe choice, so a reflexive Enter doesn't confirm. */
function focusSafeChoice() {
  // Unless the user has already moved within the dialog while it was opening.
  if ((card.value?.$el as HTMLElement | undefined)?.contains(document.activeElement)) return
  ;(safeChoice.value?.$el as HTMLElement | undefined)?.focus()
}

function restoreFocus() {
  if (returnTo?.isConnected) returnTo.focus()
  returnTo = null
}
</script>

<template>
  <v-dialog
    :model-value="open"
    max-width="28rem"
    role="alertdialog"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
    @update:model-value="(value: boolean) => !value && settleConfirmation(false)"
    @after-enter="focusSafeChoice"
    @after-leave="restoreFocus"
  >
    <v-card v-if="options" ref="card" :flat="false" :border="false" elevation="4">
      <v-card-item>
        <v-card-title
          :id="titleId"
          tag="h2"
          class="text-title-medium font-weight-semibold text-wrap"
        >
          {{ options.title }}
        </v-card-title>
      </v-card-item>
      <v-card-text :id="descriptionId" class="text-body-medium text-medium-emphasis">
        {{ options.description }}
      </v-card-text>
      <!-- Card actions default their buttons to plain text; the safe choice keeps the app's
           tonal secondary look, as "Cancel" does beside "Save changes". -->
      <v-card-actions class="flex-wrap justify-end ga-2">
        <v-btn ref="safeChoice" variant="tonal" @click="settleConfirmation(false)">
          {{ options.cancelLabel ?? 'Cancel' }}
        </v-btn>
        <v-btn
          variant="flat"
          :color="options.tone === 'danger' ? 'error' : 'primary'"
          @click="settleConfirmation(true)"
        >
          {{ options.confirmLabel }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
