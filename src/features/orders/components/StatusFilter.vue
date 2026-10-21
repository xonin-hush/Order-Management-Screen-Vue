<script setup lang="ts">
import { ORDER_STATUSES, type OrderStatus } from '../types'
import { STATUS_LABELS } from '../domain'

/** `null` = all statuses. */
const model = defineModel<OrderStatus | null>({ required: true })

const options: { value: OrderStatus | null; label: string }[] = [
  { value: null, label: 'All' },
  ...ORDER_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
]
</script>

<template>
  <!-- Native radios: one tab stop, arrow keys to move, announced as "1 of 6". Vuetify's chip
       group would make every chip a tab stop and not announce which one is selected. -->
  <fieldset class="min-w-0">
    <legend class="d-sr-only">Filter by status</legend>
    <!-- Wraps rather than scrolls: every status stays visible and reachable on small screens. -->
    <div class="status-options d-flex flex-wrap ga-2">
      <label v-for="option in options" :key="option.label" class="status-option">
        <input v-model="model" type="radio" name="status" :value="option.value" class="d-sr-only" />
        <v-chip
          size="default"
          :variant="model === option.value ? 'flat' : 'text'"
          :color="model === option.value ? 'primary' : undefined"
          :border="model !== option.value"
          class="font-weight-medium"
          :class="{ 'text-medium-emphasis': model !== option.value }"
        >
          <span v-if="option.value" class="status-dot" :class="`text-${option.value}`" />
          {{ option.label }}
        </v-chip>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
/* Positioned, so the visually hidden radio stays inside it instead of escaping a scroll area. */
.status-option {
  position: relative;
  cursor: pointer;
  user-select: none;
}

/* On touch screens the label, which is what takes the tap, reaches 44px around its 32px chip;
   rows close up, so the chips sit about as close as before (12px apart, not 8px). */
@media (pointer: coarse) {
  .status-options {
    row-gap: 0;
  }

  .status-option {
    display: flex;
    justify-content: center;
    min-width: 44px;
    padding-block: 6px;
  }
}

.status-option input:focus-visible + .v-chip {
  outline: 2px solid rgb(var(--v-theme-focus));
  outline-offset: 2px;
}

.status-option:hover .v-chip--variant-text {
  background: rgba(var(--v-theme-on-surface), var(--v-hover-opacity));
}

/* High-contrast modes replace the fill that marks the chosen status; use the system's own
   selection colours instead. */
@media (forced-colors: active) {
  .status-option input:checked + .v-chip {
    forced-color-adjust: none;
    background: Highlight;
    color: HighlightText;
  }
}
</style>
