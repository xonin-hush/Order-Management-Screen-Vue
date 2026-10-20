<script setup lang="ts">
import { mdiPackageVariantClosed } from '@mdi/js'

withDefaults(defineProps<{ size?: number }>(), { size: 28 })
</script>

<template>
  <v-avatar :size="size" color="primary" rounded="lg">
    <v-icon :icon="mdiPackageVariantClosed" :size="Math.round(size * 0.6)" />
  </v-avatar>
</template>
