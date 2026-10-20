<script setup lang="ts">
import { STATUS_LABELS } from '../domain'
import type { OrderStatus } from '../types'

defineProps<{ status: OrderStatus }>()
</script>

<template>
  <!-- Each status has a theme colour of the same name (plugins/vuetify.ts). -->
  <v-chip :color="status" class="font-weight-medium">
    <span class="status-dot" aria-hidden="true" />
    {{ STATUS_LABELS[status] }}
  </v-chip>
</template>
