<script setup lang="ts">
defineProps<{ title: string; description: string }>()
</script>

<template>
  <div class="d-flex flex-wrap align-end justify-space-between ga-4">
    <div>
      <!-- Takes focus after navigation (see route-focus), so it has no visible ring. -->
      <h1 tabindex="-1" class="text-headline-small font-weight-semibold">{{ title }}</h1>
      <p class="mt-1 text-body-medium text-medium-emphasis">{{ description }}</p>
    </div>
    <slot name="actions" />
  </div>
</template>
