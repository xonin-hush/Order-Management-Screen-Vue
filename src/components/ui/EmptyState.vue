<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    /** Decorative icon, an `@mdi/js` path. */
    icon?: string
    /** Heading tag, so the state fits the surrounding document outline. */
    as?: 'h1' | 'h2' | 'h3'
    tone?: 'neutral' | 'error'
  }>(),
  { description: undefined, icon: undefined, as: 'h2', tone: 'neutral' },
)
</script>

<template>
  <!-- Every "nothing to show here" screen in the app: empty, missing, forbidden or failed. -->
  <v-empty-state color="primary" size="48">
    <template v-if="icon" #media>
      <v-avatar
        size="48"
        :color="tone === 'error' ? 'error' : 'secondary'"
        variant="tonal"
        class="mb-1"
      >
        <v-icon :icon="icon" size="24" />
      </v-avatar>
    </template>
    <template #title>
      <!-- A page heading takes focus after navigation (see route-focus). -->
      <component
        :is="as"
        :tabindex="as === 'h1' ? -1 : undefined"
        class="text-title-medium font-weight-semibold"
      >
        {{ title }}
      </component>
    </template>
    <template v-if="description || $slots.description" #text>
      <slot name="description">{{ description }}</slot>
    </template>
    <template v-if="$slots.actions" #actions>
      <div class="d-flex flex-wrap justify-center ga-3">
        <slot name="actions" />
      </div>
    </template>
  </v-empty-state>
</template>

<style scoped>
/* Vuetify pads the actions on every side, which left 16px more below the state than above it. */
.v-empty-state {
  padding-block: 32px;
}

.v-empty-state :deep(.v-empty-state__actions) {
  padding-bottom: 0;
}
</style>
