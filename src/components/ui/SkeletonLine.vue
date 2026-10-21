<script setup lang="ts">
/**
 * One placeholder bar, sized like the text or control it stands in for, so a skeleton can
 * mirror the real layout. Decorative: put skeletons inside a `role="status"` with its own text.
 */
withDefaults(defineProps<{ width?: string | number; height?: string | number }>(), {
  width: '100%',
  height: 12,
})
</script>

<template>
  <v-skeleton-loader type="ossein" :width="width" :height="height" class="skeleton-line" />
</template>

<style scoped>
/* In Vuetify's overrides layer, so `rounded-*` utilities still reshape a bar into a button or a
   chip. Vuetify paints the loader white behind the bone; on a tinted row that would show. */
@layer vuetify-overrides {
  .skeleton-line {
    flex-shrink: 0;
    max-width: 100%;
    border-radius: 6px;
    background: transparent;
  }
}
</style>
