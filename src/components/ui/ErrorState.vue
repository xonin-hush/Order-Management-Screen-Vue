<script setup lang="ts">
import { mdiAlertCircleOutline, mdiRefresh } from '@mdi/js'
import EmptyState from './EmptyState.vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    /** Hide the retry action when retrying can't help (e.g. missing permission). */
    retryable?: boolean
    retrying?: boolean
    /** A one-line banner for errors shown alongside data that's still on screen. */
    compact?: boolean
    as?: 'h1' | 'h2' | 'h3'
  }>(),
  { description: undefined, retryable: true, retrying: false, compact: false, as: 'h2' },
)

defineEmits<{ retry: [] }>()
</script>

<template>
  <v-alert v-if="compact" type="error">
    <span class="font-weight-medium">{{ title }}</span>
    {{ description }}
    <template v-if="retryable" #append>
      <v-btn size="small" :loading="retrying" :prepend-icon="mdiRefresh" @click="$emit('retry')">
        Try again
      </v-btn>
    </template>
  </v-alert>

  <EmptyState
    v-else
    role="alert"
    tone="error"
    :icon="mdiAlertCircleOutline"
    :as="as"
    :title="title"
    :description="description"
  >
    <template v-if="retryable || $slots.actions" #actions>
      <v-btn
        v-if="retryable"
        :loading="retrying"
        :prepend-icon="mdiRefresh"
        @click="$emit('retry')"
      >
        Try again
      </v-btn>
      <slot name="actions" />
    </template>
  </EmptyState>
</template>
