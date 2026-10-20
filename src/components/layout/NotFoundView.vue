<script setup lang="ts">
import { mdiCompassOutline } from '@mdi/js'
import EmptyState from '@/components/ui/EmptyState.vue'
</script>

<template>
  <EmptyState
    as="h1"
    :icon="mdiCompassOutline"
    title="Page not found"
    description="The address may be mistyped, or the page may have moved."
    class="py-16"
  >
    <template #actions>
      <v-btn :to="{ name: 'orders' }">Go to orders</v-btn>
    </template>
  </EmptyState>
</template>
