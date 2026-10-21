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
  /** New results are on their way: a bar runs along the top edge. */
  loading?: boolean
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
  <v-card :loading="loading" class="orders-table">
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
/* The headings stay in view under the app bar while a long list scrolls. The card clips its
   corners with `clip`, not `hidden`, which would make it the scroller the header sticks to;
   from 768px, where it's shown, the table fits without a scrollbar of its own. */
.orders-table {
  overflow: clip;
}

.orders-table :deep(.v-table__wrapper) {
  overflow: visible;
}

.orders-table :deep(thead th) {
  position: sticky;
  top: var(--v-layout-top, 0px);
  z-index: 1;
}

/* The customer column takes the spare width and truncates long names. */
.customer {
  width: 100%;
  max-width: 0;
}

/* Vuetify's row hover lays a tint over each data cell (td::after), with no transition. The order
   number is a row header, so it gets the very same overlay: tinting its background instead faded
   it in over Vuetify's 0.28s cell transition, behind the rest of the row. */
tbody > tr > th {
  position: relative;
}

tbody > tr:hover > th::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(var(--v-border-color), var(--v-hover-opacity));
  pointer-events: none;
}

.order-link {
  text-decoration: none;
  text-underline-offset: 4px;
  /* Focused while tabbing back up the list: clear of the sticky headings, not under them. */
  scroll-margin-top: 3rem;
}

.order-link:hover {
  text-decoration: underline;
}
</style>
