<script setup lang="ts">
import { computed } from 'vue'
import { mdiCheck } from '@mdi/js'
import { STATUS_LABELS } from '../domain'
import type { OrderStatus } from '../types'

/** Where an order is on its way to the customer. Cancelled orders have left the path. */
const props = defineProps<{ status: Exclude<OrderStatus, 'cancelled'> }>()

const STEPS = ['pending', 'processing', 'shipped', 'delivered'] as const
const current = computed(() => STEPS.indexOf(props.status))

/** Delivered is the end of the path: that step is done, not in progress. */
const isDone = (index: number) =>
  index < current.value || (index === current.value && props.status === 'delivered')
</script>

<template>
  <!-- Drawn in the colour of the current status, like its badge (plugins/vuetify.ts). -->
  <ol
    aria-label="Order progress"
    class="order-progress text-body-small"
    :style="{ '--progress-color': `rgb(var(--v-theme-${status}))` }"
  >
    <li
      v-for="(step, index) in STEPS"
      :key="step"
      class="order-progress__step"
      :class="{
        'order-progress__step--reached': index <= current,
        'order-progress__step--current': index === current,
        'order-progress__step--active': index === current && !isDone(index),
      }"
      :aria-current="index === current ? 'step' : undefined"
    >
      <span class="order-progress__marker" aria-hidden="true">
        <v-icon v-if="isDone(index)" :icon="mdiCheck" size="14" />
      </span>
      <span class="order-progress__label">
        {{ STATUS_LABELS[step] }}
        <span v-if="isDone(index)" class="d-sr-only">(done)</span>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.order-progress {
  --marker-size: 20px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

.order-progress__step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

/* The line from the previous step's marker to this one's. */
.order-progress__step + .order-progress__step::before {
  content: '';
  position: absolute;
  top: calc(var(--marker-size) / 2 - 1px);
  inset-inline: calc(-50% + var(--marker-size) / 2 + 6px) calc(50% + var(--marker-size) / 2 + 6px);
  height: 2px;
  border-radius: 1px;
  background: rgba(var(--v-border-color), var(--v-border-opacity));
}

.order-progress__step + .order-progress__step--reached::before {
  background: var(--progress-color);
}

.order-progress__marker {
  display: grid;
  place-items: center;
  width: var(--marker-size);
  height: var(--marker-size);
  border: 2px solid rgba(var(--v-border-color), 0.2);
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-surface));
}

.order-progress__step--reached .order-progress__marker {
  border-color: var(--progress-color);
  background: var(--progress-color);
}

/* In progress: a ring around a dot, rather than a check. */
.order-progress__step--active .order-progress__marker {
  background: rgb(var(--v-theme-surface));
}

.order-progress__step--active .order-progress__marker::after {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--progress-color);
}

.order-progress__label {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.order-progress__step--reached .order-progress__label {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.order-progress__step--current .order-progress__label {
  font-weight: 600;
}
</style>
