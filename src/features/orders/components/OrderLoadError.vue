<script setup lang="ts">
import { inject } from 'vue'
import { mdiLockOutline, mdiMagnifyClose } from '@mdi/js'
import { errorMessage, isApiError } from '@/api/errors'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { sidePanelKey } from '@/components/ui/side-panel'

/** Why an order couldn't be shown in a panel. Missing or forbidden isn't a malfunction. */
defineProps<{ error: unknown; retrying: boolean }>()
defineEmits<{ retry: [] }>()

const panel = inject(sidePanelKey)!
</script>

<template>
  <EmptyState
    v-if="isApiError(error, 'not_found')"
    as="h3"
    :icon="mdiMagnifyClose"
    title="Order not found"
    description="It may have been removed, or the link may be wrong."
  >
    <template #actions>
      <v-btn @click="panel.close()">Back to orders</v-btn>
    </template>
  </EmptyState>
  <EmptyState
    v-else-if="isApiError(error, 'forbidden')"
    as="h3"
    :icon="mdiLockOutline"
    title="You don't have access to this order"
    :description="errorMessage(error)"
  />
  <ErrorState
    v-else
    as="h3"
    title="We couldn't load this order"
    :description="errorMessage(error)"
    :retrying="retrying"
    @retry="$emit('retry')"
  />
</template>
