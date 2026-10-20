<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mdiLockOutline } from '@mdi/js'
import EmptyState from '@/components/ui/EmptyState.vue'
import SidePanelHeader from '@/components/ui/SidePanelHeader.vue'
import OrderForm from './components/OrderForm.vue'
import { isApiError } from '@/api/errors'
import OrderLoadError from './components/OrderLoadError.vue'
import { isFinal } from './domain'
import { useOrderQuery } from './queries'
import type { Order } from './types'

const props = defineProps<{ id: number }>()

const route = useRoute()
const { data: order, error, isLoadingError, isFetching, refetch } = useOrderQuery(() => props.id)

// The form edits a snapshot, so a background refresh never throws away what the user typed,
// unless saving has become impossible (the order is now final or gone). Last write wins.
const editing = shallowRef<Order>()
watch(
  order,
  (loaded) => {
    if (loaded && !editing.value && !isFinal(loaded.status)) editing.value = loaded
  },
  { immediate: true },
)

const title = computed(() => (order.value ? `Edit ${order.value.number}` : 'Edit order'))
const description = computed(() => {
  if (order.value) return "Update the customer's details or what they ordered."
  return isLoadingError.value ? "This order couldn't be loaded." : 'Loading order details…'
})
</script>

<template>
  <div class="side-panel__page">
    <SidePanelHeader :title="title">
      <template #description>{{ description }}</template>
    </SidePanelHeader>

    <div v-if="isLoadingError || isApiError(error, 'not_found')" class="side-panel__scroll">
      <OrderLoadError :error="error" :retrying="isFetching" @retry="refetch()" />
    </div>

    <!-- Final orders can't be saved (the API answers 409), so say so instead of offering a form,
         also when the order became final while it was being edited. -->
    <div v-else-if="order && isFinal(order.status)" class="side-panel__scroll">
      <EmptyState
        as="h3"
        :icon="mdiLockOutline"
        title="This order can't be edited"
        :description="`${order.number} is ${order.status}. Delivered and cancelled orders are final.`"
      >
        <template #actions>
          <v-btn
            :to="{ name: 'order-details', params: { id: order.id }, query: route.query }"
            replace
          >
            Back to order
          </v-btn>
        </template>
      </EmptyState>
    </div>

    <OrderForm v-else-if="editing" :order="editing" />

    <div v-else role="status" class="side-panel__scroll">
      <span class="d-sr-only">Loading order details…</span>
      <v-skeleton-loader aria-hidden="true" type="text@3, card" />
    </div>
  </div>
</template>
