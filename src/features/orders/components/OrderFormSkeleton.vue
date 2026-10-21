<script setup lang="ts">
import SkeletonLine from '@/components/ui/SkeletonLine.vue'
</script>

<template>
  <!-- The order form's layout, down to its footer, while the order to edit loads. Outlined
       boxes stand in for the outlined fields. -->
  <div class="side-panel__page">
    <div class="side-panel__scroll d-flex flex-column ga-8">
      <div>
        <SkeletonLine :width="72" :height="14" class="my-1" />
        <div class="mt-4 d-flex flex-column ga-4">
          <div class="field"><SkeletonLine :width="96" /></div>
          <div>
            <div class="field"><SkeletonLine :width="124" /></div>
            <SkeletonLine :width="220" :height="10" class="mt-2 ms-4" />
          </div>
          <div class="field field--tall"><SkeletonLine :width="132" /></div>
        </div>
      </div>

      <div>
        <SkeletonLine :width="48" :height="14" class="my-1" />
        <v-card class="mt-4 pa-4">
          <div class="d-flex align-center justify-space-between heading">
            <SkeletonLine :width="56" />
            <SkeletonLine :width="80" :height="28" class="rounded-lg" />
          </div>
          <div class="field mt-3"><SkeletonLine :width="72" /></div>
          <div class="numbers mt-4">
            <div class="field"><SkeletonLine :width="24" /></div>
            <div class="field"><SkeletonLine :width="64" /></div>
          </div>
          <SkeletonLine :width="140" class="mt-4 ms-auto" />
        </v-card>
      </div>
    </div>

    <div class="side-panel__footer d-flex align-center justify-space-between ga-3">
      <SkeletonLine :width="120" :height="20" />
      <div class="d-flex ga-2">
        <SkeletonLine :width="84" :height="36" class="rounded-lg" />
        <SkeletonLine :width="124" :height="36" class="rounded-lg" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  align-items: center;
  height: 48px;
  padding-inline: 16px;
  border: thin solid rgba(var(--v-border-color), 0.2);
  border-radius: 8px;
}

.field--tall {
  align-items: start;
  height: 72px;
  padding-top: 18px;
}

.heading {
  min-height: 32px;
}

/* Like the item's quantity and price fields. */
.numbers {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: 12px;
}
</style>
