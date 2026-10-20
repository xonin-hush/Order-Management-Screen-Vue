<script setup lang="ts">
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router'
import { formatMoney, formatRelativeDate } from '@/lib/format'
import type { OrderSummary } from '../types'
import StatusBadge from './StatusBadge.vue'

const props = defineProps<{
  orders: OrderSummary[]
  /** Only for users with `orders.view_amount`; the API doesn't send amounts otherwise. */
  showAmounts: boolean
  linkTo: (order: OrderSummary) => RouteLocationRaw
}>()

const router = useRouter()

/**
 * The order number is the real link (keyboard, screen readers, open in new tab); clicking
 * anywhere else on the row is a mouse convenience that does the same.
 */
function openFromRow(event: MouseEvent, order: OrderSummary) {
  if ((event.target as HTMLElement).closest('a, button')) return
  if (window.getSelection()?.toString()) return // the user is selecting text
  void router.push(props.linkTo(order))
}
</script>

<template>
  <v-card>
    <v-table hover>
      <caption class="d-sr-only">
        Orders
      </caption>
      <thead>
        <tr>
          <th scope="col">Order</th>
          <th scope="col">Customer</th>
          <th scope="col">Date</th>
          <th scope="col">Status</th>
          <th v-if="showAmounts" scope="col" class="text-end">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="order in orders"
          :key="order.id"
          class="cursor-pointer"
          @click="openFromRow($event, order)"
        >
          <th scope="row" class="text-no-wrap">
            <RouterLink
              :to="linkTo(order)"
              :data-order-link="order.id"
              class="order-link rounded-sm font-weight-medium text-high-emphasis tabular-nums"
            >
              {{ order.number }}
            </RouterLink>
          </th>
          <td class="customer text-truncate">{{ order.customerName }}</td>
          <td class="text-no-wrap text-medium-emphasis">
            <time :datetime="order.createdAt">{{ formatRelativeDate(order.createdAt) }}</time>
          </td>
          <td><StatusBadge :status="order.status" /></td>
          <td v-if="showAmounts" class="text-end text-no-wrap tabular-nums">
            {{ order.amount === undefined ? '—' : formatMoney(order.amount) }}
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-card>
</template>

<style scoped>
/* The customer column takes the spare width and truncates long names. */
.customer {
  width: 100%;
  max-width: 0;
}

/* Vuetify's row hover covers data cells only; the order number is a row header. */
tbody tr:hover > th {
  background: rgba(var(--v-border-color), var(--v-hover-opacity));
}

.order-link {
  text-decoration: none;
  text-underline-offset: 4px;
}

.order-link:hover {
  text-decoration: underline;
}
</style>
