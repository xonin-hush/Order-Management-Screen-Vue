<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import ErrorState from '@/components/ui/ErrorState.vue'
import SidePanelHeader from '@/components/ui/SidePanelHeader.vue'
import { useSessionStore } from '@/features/auth/session.store'
import { errorMessage, isApiError } from '@/api/errors'
import { formatDateTime, formatMoney } from '@/lib/format'
import { parseIraqiMobile } from '@/lib/phone'
import OrderActions from './components/OrderActions.vue'
import OrderDetailsSkeleton from './components/OrderDetailsSkeleton.vue'
import OrderLoadError from './components/OrderLoadError.vue'
import OrderProgress from './components/OrderProgress.vue'
import StatusBadge from './components/StatusBadge.vue'
import { EDIT_ORDER_PERMISSIONS } from './permissions'
import { findCachedSummary, useOrderQuery } from './queries'

const props = defineProps<{ id: number }>()

const session = useSessionStore()
const queryClient = useQueryClient()
const {
  data: order,
  error,
  isPending,
  isLoadingError,
  isRefetchError,
  isFetching,
  refetch,
} = useOrderQuery(() => props.id)

// What the list already knew when the panel opened: enough for the header to be complete
// immediately. (A one-off read: the panel is re-created for every order.)
const summary = findCachedSummary(queryClient, props.id)
const title = computed(
  () =>
    order.value?.number ?? summary?.number ?? (isLoadingError.value ? 'Order' : 'Loading order…'),
)
const status = computed(() => order.value?.status ?? summary?.status)

const description = computed(() => {
  if (!order.value)
    return isLoadingError.value ? "This order couldn't be loaded." : 'Loading order details…'
  const placed = `Placed ${formatDateTime(order.value.createdAt)}`
  return order.value.updatedAt === order.value.createdAt
    ? placed
    : `${placed} · Updated ${formatDateTime(order.value.updatedAt)}`
})

const showAmounts = computed(() => session.can('orders.view_amount'))
/** Whether OrderActions will have buttons, so the skeleton can keep their place. */
const showActions = computed(
  () =>
    session.can('orders.update_status') ||
    session.can('orders.cancel') ||
    session.canAll(EDIT_ORDER_PERMISSIONS),
)
/** In international form, so the link dials from anywhere: tel:+9647701234567. */
const phoneHref = computed(
  () => order.value && parseIraqiMobile(order.value.customer.phone)?.getURI(),
)

watchEffect(() => {
  if (order.value) document.title = `${order.value.number} · OrderDesk`
})
</script>

<template>
  <div class="side-panel__page">
    <SidePanelHeader :title="title">
      <template #badge><StatusBadge v-if="status" :status="status" /></template>
      <template #description>{{ description }}</template>
    </SidePanelHeader>

    <div class="side-panel__scroll">
      <div v-if="isPending" role="status">
        <span class="d-sr-only">Loading order details…</span>
        <OrderDetailsSkeleton
          aria-hidden="true"
          :status="status"
          :show-actions="showActions"
          :show-amounts="showAmounts"
        />
      </div>

      <!-- Also when a refresh finds the order gone: its actions would only fail. -->
      <OrderLoadError
        v-else-if="isLoadingError || isApiError(error, 'not_found')"
        :error="error"
        :retrying="isFetching"
        @retry="refetch()"
      />

      <!-- Once loaded, the order stays on screen even if a later refresh fails. -->
      <div v-else-if="order" class="d-flex flex-column ga-8 fade-in">
        <ErrorState
          v-if="isRefetchError"
          compact
          title="Couldn't refresh this order."
          :description="errorMessage(error)"
          :retrying="isFetching"
          @retry="refetch()"
        />
        <div v-if="order.status !== 'cancelled' || showActions" class="d-flex flex-column ga-6">
          <OrderProgress v-if="order.status !== 'cancelled'" :status="order.status" />
          <OrderActions :order="order" />
        </div>

        <section aria-labelledby="order-customer-heading">
          <h3 id="order-customer-heading" class="section-title">Customer</h3>
          <v-card class="mt-3">
            <dl class="detail-rows text-body-medium">
              <div>
                <dt>Name</dt>
                <dd>{{ order.customer.name }}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>
                  <a
                    v-if="phoneHref"
                    :href="phoneHref"
                    class="phone text-high-emphasis tabular-nums"
                  >
                    {{ order.customer.phone }}
                  </a>
                  <span v-else class="tabular-nums">{{ order.customer.phone }}</span>
                </dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{{ order.customer.address }}</dd>
              </div>
            </dl>
          </v-card>
        </section>

        <section aria-labelledby="order-items-heading">
          <h3 id="order-items-heading" class="section-title">
            Items
            <span class="font-weight-regular text-medium-emphasis">({{ order.items.length }})</span>
          </h3>
          <v-card class="mt-3">
            <v-table density="comfortable" class="text-body-medium">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="text-end">{{ showAmounts ? 'Amount' : 'Qty' }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in order.items" :key="item.id">
                  <td class="py-3">
                    <span class="d-block">{{ item.product }}</span>
                    <span
                      v-if="showAmounts && item.unitPrice !== undefined"
                      class="d-block text-medium-emphasis tabular-nums"
                    >
                      {{ item.quantity }} × {{ formatMoney(item.unitPrice) }}
                    </span>
                  </td>
                  <td class="py-3 text-end align-top text-no-wrap tabular-nums">
                    <template v-if="showAmounts && item.unitPrice !== undefined">
                      {{ formatMoney(item.quantity * item.unitPrice) }}
                    </template>
                    <template v-else>{{ item.quantity }}</template>
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="showAmounts && order.amount !== undefined" class="bg-surface-light">
                <tr>
                  <th scope="row" class="text-start font-weight-medium">Total</th>
                  <td class="text-end font-weight-semibold text-no-wrap tabular-nums">
                    {{ formatMoney(order.amount) }}
                  </td>
                </tr>
              </tfoot>
            </v-table>
          </v-card>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
dt {
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.phone {
  text-decoration-color: rgba(var(--v-border-color), 0.3);
  text-underline-offset: 4px;
}

.phone:hover {
  text-decoration-color: currentColor;
}
</style>
