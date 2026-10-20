<script setup lang="ts">
import { inject } from 'vue'
import { mdiClose } from '@mdi/js'
import { sidePanelKey } from './side-panel'

defineProps<{ title: string }>()

const panel = inject(sidePanelKey)!
</script>

<template>
  <header class="d-flex align-start ga-4 border-b px-5 px-sm-6 py-4">
    <div class="flex-grow-1 min-w-0">
      <div class="d-flex flex-wrap align-center gc-3 gr-1">
        <!-- Programmatic focus target (see SidePanel); not interactive, so no focus ring. -->
        <h2
          :id="panel.titleId"
          data-panel-heading
          tabindex="-1"
          class="text-title-large font-weight-semibold"
        >
          {{ title }}
        </h2>
        <slot name="badge" />
      </div>
      <p :id="panel.descriptionId" class="mt-1 text-body-medium text-medium-emphasis">
        <slot name="description" />
      </p>
    </div>
    <v-btn
      :icon="mdiClose"
      variant="text"
      size="small"
      aria-label="Close panel"
      class="me-n2 mt-n1"
      @click="panel.close()"
    />
  </header>
</template>
