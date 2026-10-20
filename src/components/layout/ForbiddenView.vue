<script setup lang="ts">
import { mdiLockOutline } from '@mdi/js'
import EmptyState from '@/components/ui/EmptyState.vue'
</script>

<template>
  <EmptyState
    as="h1"
    :icon="mdiLockOutline"
    title="You don't have access to this page"
    description="Your role doesn't include permission to open it. If you think you should have access, ask an administrator."
    class="py-16"
  >
    <template #actions>
      <v-btn :to="{ name: 'orders' }">Go to orders</v-btn>
    </template>
  </EmptyState>
</template>
