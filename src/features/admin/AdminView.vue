<script setup lang="ts">
import { mdiShieldCheckOutline } from '@mdi/js'
import PageHeader from '@/components/layout/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
</script>

<template>
  <div>
    <PageHeader title="Admin" description="Settings and tools for administrators." />

    <v-card class="mt-8 border-dashed">
      <EmptyState :icon="mdiShieldCheckOutline" title="Nothing here yet" class="py-16">
        <template #description>
          This page is a placeholder. Only people with the
          <code>admin.access</code> permission can open it.
        </template>
      </EmptyState>
    </v-card>
  </div>
</template>
