<script setup lang="ts">
import { STATUS_LABELS } from '../domain'
import type { OrderStatus } from '../types'

defineProps<{ status: OrderStatus }>()
</script>

<template>
  <!-- Each status has a theme colour of the same name (plugins/vuetify.ts). -->
  <v-chip :color="status" class="status-badge font-weight-medium">
    <span class="status-dot" aria-hidden="true" />
    {{ STATUS_LABELS[status] }}
  </v-chip>
</template>

<style scoped>
/* A new status fades in; the tint and the dot are drawn in the text colour, so they follow. */
.status-badge {
  transition: color 250ms ease-out;
}
</style>
