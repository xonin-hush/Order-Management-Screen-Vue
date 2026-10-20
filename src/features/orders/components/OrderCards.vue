<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { formatMoney, formatRelativeDate } from '@/lib/format'
import type { OrderSummary } from '../types'
import StatusBadge from './StatusBadge.vue'

defineProps<{
  orders: OrderSummary[]
  showAmounts: boolean
  linkTo: (order: OrderSummary) => RouteLocationRaw
}>()
</script>

<template>
  <ul aria-label="Orders" class="d-flex flex-column ga-2">
    <li v-for="order in orders" :key="order.id">
      <!-- The whole card is the link. -->
      <v-card :to="linkTo(order)" :data-order-link="order.id" class="px-4 py-3">
        <span class="d-flex align-center justify-space-between ga-3">
          <span class="text-body-medium font-weight-semibold tabular-nums">{{ order.number }}</span>
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
</template>
