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
        <Transition name="check">
          <v-icon v-if="isDone(index)" :icon="mdiCheck" size="14" class="order-progress__check" />
        </Transition>
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
  /* A step forward plays in order: the step just done fills in and the line draws out of it,
     then the next step lights up as the line reaches it. Under half a second in all. */
  --progress-duration: 250ms;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
}

/* Without motion there's nothing to wait for. */
@media (prefers-reduced-motion: no-preference) {
  .order-progress__step--current {
    --step-delay: 200ms;
  }
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

/* The line from the previous step's marker to this one's: a grey track, and over it a fill
   drawn along it once this step is reached. */
.order-progress__step + .order-progress__step::before,
.order-progress__step + .order-progress__step::after {
  content: '';
  position: absolute;
  top: calc(var(--marker-size) / 2 - 1px);
  inset-inline: calc(-50% + var(--marker-size) / 2 + 6px) calc(50% + var(--marker-size) / 2 + 6px);
  height: 2px;
  border-radius: 1px;
}

.order-progress__step + .order-progress__step::before {
  background: rgba(var(--v-border-color), var(--v-border-opacity));
}

.order-progress__step + .order-progress__step::after {
  background: var(--progress-color);
  transform: scaleX(0);
  transform-origin: left;
  transition:
    transform var(--progress-duration) ease-out,
    background-color var(--progress-duration) ease-out;
}

.order-progress:dir(rtl) .order-progress__step::after {
  transform-origin: right;
}

.order-progress__step + .order-progress__step--reached::after {
  transform: none;
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
  transition-property: border-color, background-color;
  transition-duration: var(--progress-duration);
  transition-timing-function: ease-out;
  transition-delay: var(--step-delay, 0s);
}

.order-progress__step--reached .order-progress__marker {
  border-color: var(--progress-color);
  background: var(--progress-color);
}

/* In progress: a ring around a dot, rather than a check. */
.order-progress__step--active .order-progress__marker {
  background: rgb(var(--v-theme-surface));
}

/* The dot and the check share the middle of the marker, the check on top. */
.order-progress__marker::before,
.order-progress__check {
  grid-area: 1 / 1;
}

.order-progress__marker::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--progress-color);
  transform: scale(0);
  transition: transform var(--progress-duration) ease-out var(--step-delay, 0s);
}

.order-progress__step--active .order-progress__marker::before {
  transform: none;
}

.check-enter-active {
  transition:
    transform var(--progress-duration) ease-out var(--step-delay, 0s),
    opacity var(--progress-duration) ease-out var(--step-delay, 0s);
}

.check-enter-from {
  transform: scale(0.5);
  opacity: 0;
}

.order-progress__label {
  max-width: 100%;
  overflow-wrap: anywhere;
  transition: color var(--progress-duration) ease-out var(--step-delay, 0s);
}

.order-progress__step--reached .order-progress__label {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}

.order-progress__step--current .order-progress__label {
  font-weight: 600;
}

/* High-contrast modes drop the fills that tell done, current and upcoming steps apart; draw
   them in system colours: reached in the selection colour, the rest in grey. */
@media (forced-colors: active) {
  .order-progress {
    --progress-color: Highlight;
  }

  .order-progress__marker,
  .order-progress__step + .order-progress__step::before,
  .order-progress__step + .order-progress__step::after {
    forced-color-adjust: none;
  }

  .order-progress__marker {
    border-color: GrayText;
    background: Canvas;
    color: HighlightText;
  }

  .order-progress__step + .order-progress__step::before {
    background: GrayText;
  }

  .order-progress__step--active .order-progress__marker {
    background: Canvas;
  }
}
</style>
