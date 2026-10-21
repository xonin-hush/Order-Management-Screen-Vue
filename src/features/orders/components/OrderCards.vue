<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { formatMoney, formatRelativeDate } from '@/lib/format'
import type { OrderSummary } from '../types'
import StatusBadge from './StatusBadge.vue'

defineProps<{
  orders: OrderSummary[]
  showAmounts: boolean
  linkTo: (order: OrderSummary) => RouteLocationRaw
  /** New results are on their way: a bar runs along the top edge. */
  loading?: boolean
}>()
</script>

<template>
  <!-- One grouped list rather than a stack of cards: more orders per screen, less chrome. -->
  <v-card :loading="loading">
    <ul aria-label="Orders">
      <li v-for="order in orders" :key="order.id" class="order-row">
        <!-- The whole row is the link. -->
        <v-card
          :to="linkTo(order)"
          :data-order-link="order.id"
          :border="false"
          rounded="0"
          class="px-4 py-3"
        >
          <span class="d-flex align-center justify-space-between ga-3">
            <span class="text-body-medium font-weight-semibold tabular-nums">
              {{ order.number }}
            </span>
            <StatusBadge :status="order.status" />
          </span>
          <span class="d-block mt-1 text-body-medium text-truncate">{{ order.customerName }}</span>
          <span class="d-flex align-center justify-space-between ga-3 mt-1 text-body-medium">
            <time :datetime="order.createdAt" class="text-medium-emphasis">
              {{ formatRelativeDate(order.createdAt) }}
            </time>
            <span
              v-if="showAmounts && order.amount !== undefined"
              class="font-weight-medium tabular-nums"
            >
              {{ formatMoney(order.amount) }}
            </span>
          </span>
        </v-card>
      </li>
    </ul>
  </v-card>
</template>

<style scoped>
.order-row + .order-row {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* The list's card clips its contents, so the ring goes inside the row. */
.order-row > .v-card:focus-visible {
  outline-offset: -2px;
}
</style>
