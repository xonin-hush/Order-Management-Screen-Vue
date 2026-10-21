<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useDisplay } from 'vuetify'
import { mdiInboxOutline, mdiMagnifyClose, mdiPlus } from '@mdi/js'
import { errorMessage, isApiError } from '@/api/errors'
import PageHeader from '@/components/layout/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import SidePanel from '@/components/ui/SidePanel.vue'
import { useSessionStore } from '@/features/auth/session.store'
import { goBackOr } from '@/lib/navigation'
import OrderCards from './components/OrderCards.vue'
import OrdersSkeleton from './components/OrdersSkeleton.vue'
import OrdersTable from './components/OrdersTable.vue'
import SearchField from './components/SearchField.vue'
import StatusFilter from './components/StatusFilter.vue'
import { STATUS_LABELS } from './domain'
import { readFilters } from './filters'
import { CREATE_ORDER_PERMISSIONS } from './permissions'
import { useOrdersQuery } from './queries'
import type { OrderStatus, OrderSummary } from './types'

const SEARCH_DEBOUNCE_MS = 300

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
// The table needs room for five columns; below that, orders are cards.
const { mdAndUp: isWide } = useDisplay()

const filters = computed(() => readFilters(route.query))
const hasFilters = computed(() => filters.value.q !== '' || filters.value.status !== null)
const showAmounts = computed(() => session.can('orders.view_amount'))
const canCreate = computed(() => session.canAll(CREATE_ORDER_PERMISSIONS))
const newOrderLink = computed(() => ({ name: 'order-create', query: route.query }))

const {
  data: orders,
  error,
  isPending,
  isFetching,
  isLoadingError,
  isRefetchError,
  isPlaceholderData,
  refetch,
} = useOrdersQuery(filters)

function updateQuery(changes: Record<string, string | undefined>) {
  // Only the query string changes, so a panel opened on top of the list stays open.
  return router.replace({ query: { ...route.query, ...changes } })
}

// Search: the input keeps exactly what the user types; the URL (and so the request) follows
// once they pause. Results are keyed by the applied text, so fast typing can't show stale data.
const searchText = ref(filters.value.q)
let appliedSearch = filters.value.q
let pendingSearch: ReturnType<typeof setTimeout> | undefined

function applySearch(value: string) {
  clearTimeout(pendingSearch)
  const q = value.trim()
  if (q === filters.value.q) return
  appliedSearch = q
  void updateQuery({ q: q || undefined })
}

watch(searchText, (value) => {
  clearTimeout(pendingSearch)
  pendingSearch = setTimeout(() => applySearch(value), SEARCH_DEBOUNCE_MS)
})

// A search still waiting for its debounce would otherwise rewrite the next page's URL.
onBeforeRouteLeave(() => clearTimeout(pendingSearch))
onBeforeUnmount(() => clearTimeout(pendingSearch))

// The URL changed from outside (Back/Forward): reflect it in the input.
watch(
  () => filters.value.q,
  (q) => {
    if (q === appliedSearch) return
    appliedSearch = q
    searchText.value = q
  },
)

const status = computed({
  get: () => filters.value.status,
  set: (value: OrderStatus | null) => void updateQuery({ status: value ?? undefined }),
})

function clearFilters() {
  searchText.value = ''
  appliedSearch = ''
  void updateQuery({ q: undefined, status: undefined })
  // The button disappears with the empty state; continue from the search box.
  document.getElementById('order-search')?.focus()
}

/**
 * A failed load that's tried again goes back to pending, so the previous filter's results would
 * stand in for it as placeholder data; show the skeleton instead, as on the first load.
 */
const retryingLoad = ref(false)

/** After a successful retry the button is gone: don't leave keyboard focus on nothing. */
async function retryLoading() {
  retryingLoad.value = true
  try {
    await refetch()
  } finally {
    retryingLoad.value = false
  }
  if (document.activeElement === document.body) {
    document.querySelector<HTMLElement>('main h1')?.focus()
  }
}

const isUpdating = computed(
  () => isPlaceholderData.value || searchText.value.trim() !== filters.value.q,
)

/**
 * In place of the list on the first load, while new results load after an empty one ("nothing
 * matches" would be stale) and while a failed load is retried (the previous filter's results
 * aren't these). Otherwise the previous results stay, dimmed, until the new ones arrive.
 */
const showSkeleton = computed(
  () =>
    isPending.value ||
    (isPlaceholderData.value && (orders.value?.length === 0 || retryingLoad.value)),
)

/** The previous results are on screen, standing in for the new filters' ones until they arrive. */
const awaitingResults = computed(() => isPlaceholderData.value && !showSkeleton.value)

/**
 * The line above the results, announced to screen readers: their count, or, while the previous
 * results stand in for new filters' ones, which orders are on their way. (The skeleton says it
 * itself.)
 */
const resultsSummary = computed(() => {
  if (!orders.value || showSkeleton.value) return ''
  if (awaitingResults.value) {
    const { q, status: selected } = filters.value
    const which = selected ? `${STATUS_LABELS[selected].toLowerCase()} orders` : 'orders'
    return `Loading ${which}${q ? ` matching “${q}”` : ''}…`
  }
  const count = orders.value.length
  return `${count} ${count === 1 ? 'order' : 'orders'}${hasFilters.value ? ' found' : ''}`
})

const emptyDescription = computed(() => {
  const { q, status: selected } = filters.value
  const statusText = selected ? ` with status ${STATUS_LABELS[selected].toLowerCase()}` : ''
  return q
    ? `Nothing matches “${q}”${statusText}. Try another search or status.`
    : `There are no orders${statusText} right now.`
})

// Side panel (details, create, edit) is a child route rendered on top of the list.
const panelOpen = computed(() => route.matched.length > 2)
const panelOrderId = computed(() => (route.params.id ? Number(route.params.id) : null))

function orderLink(order: OrderSummary): RouteLocationRaw {
  return { name: 'order-details', params: { id: order.id }, query: route.query }
}

function closePanel() {
  goBackOr(router, { name: 'orders', query: route.query })
}

// Remember what had focus and which order was shown, to put keyboard users back on close.
let focusBeforePanel: HTMLElement | null = null
let lastOrderId: number | null = null
watch(panelOpen, (open) => {
  if (open) focusBeforePanel = document.activeElement as HTMLElement | null
})
watch(
  panelOrderId,
  (id) => {
    if (id !== null) lastOrderId = id
  },
  { immediate: true },
)

/** The order's row if it's on screen, else whatever opened the panel, else the search box. */
function returnFocus() {
  const row =
    lastOrderId === null
      ? null
      : document.querySelector<HTMLElement>(`[data-order-link="${lastOrderId}"]`)
  const trigger =
    focusBeforePanel?.isConnected && !['BODY', 'MAIN'].includes(focusBeforePanel.tagName)
      ? focusBeforePanel
      : null
  ;(row ?? trigger ?? document.getElementById('order-search'))?.focus()
  focusBeforePanel = null
  lastOrderId = null
}
</script>

<template>
  <div>
    <PageHeader title="Orders" description="Search, review and manage customer orders.">
      <template v-if="canCreate" #actions>
        <v-btn variant="flat" color="primary" :prepend-icon="mdiPlus" :to="newOrderLink">
          New order
        </v-btn>
      </template>
    </PageHeader>

    <!-- Side by side, the search gives up width before a status chip has to wrap. -->
    <div class="toolbar mt-6">
      <SearchField v-model="searchText" class="toolbar__search" @submit="applySearch" />
      <StatusFilter v-model="status" />
    </div>

    <!-- Not a <p>: Vuetify's spinner is a block element. -->
    <div
      role="status"
      class="results-summary mt-4 d-flex align-center ga-2 text-body-medium text-medium-emphasis"
    >
      <v-progress-circular
        v-if="awaitingResults"
        indeterminate
        size="14"
        width="2"
        aria-hidden="true"
      />
      <span class="min-w-0 text-truncate">{{ resultsSummary }}</span>
    </div>

    <div class="mt-2">
      <OrdersSkeleton v-if="showSkeleton" :compact="!isWide" :show-amounts="showAmounts" />

      <v-card v-else-if="isLoadingError" class="fade-in">
        <ErrorState
          v-if="isApiError(error, 'forbidden')"
          title="You don't have access to orders"
          :description="errorMessage(error)"
          :retryable="false"
        />
        <ErrorState
          v-else
          title="We couldn't load the orders"
          :description="errorMessage(error)"
          :retrying="isFetching"
          @retry="retryLoading"
        />
      </v-card>

      <div
        v-else-if="orders"
        :aria-busy="isPlaceholderData || undefined"
        class="results fade-in"
        :class="{ 'results--updating': isPlaceholderData }"
      >
        <ErrorState
          v-if="isRefetchError"
          compact
          class="mb-4"
          title="Couldn't refresh the orders."
          :description="errorMessage(error)"
          :retrying="isFetching"
          @retry="retryLoading"
        />

        <v-card v-if="orders.length === 0">
          <EmptyState
            v-if="hasFilters"
            :icon="mdiMagnifyClose"
            title="No orders match these filters"
            :description="emptyDescription"
          >
            <template #actions>
              <v-btn @click="clearFilters">Clear filters</v-btn>
            </template>
          </EmptyState>
          <EmptyState
            v-else
            :icon="mdiInboxOutline"
            title="No orders yet"
            description="Orders will show up here as soon as they're placed."
          >
            <template v-if="canCreate" #actions>
              <v-btn variant="flat" color="primary" :prepend-icon="mdiPlus" :to="newOrderLink">
                New order
              </v-btn>
            </template>
          </EmptyState>
        </v-card>
        <!-- The loader sits on the results, whichever control changed them. -->
        <OrdersTable
          v-else-if="isWide"
          :orders="orders"
          :show-amounts="showAmounts"
          :link-to="orderLink"
          :loading="isUpdating"
        />
        <OrderCards
          v-else
          :orders="orders"
          :show-amounts="showAmounts"
          :link-to="orderLink"
          :loading="isUpdating"
        />
      </div>
    </div>

    <RouterView v-slot="{ Component }">
      <SidePanel
        :open="panelOpen"
        :content-key="String(route.name)"
        :return-focus="returnFocus"
        @close="closePanel"
      >
        <!-- Keyed by path: a different order always gets a fresh component. -->
        <component :is="Component" :key="route.path" />
      </SidePanel>
    </RouterView>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* From 1145px (Vuetify's lg) the search and the status chips share a row. */
@media (min-width: 1145px) {
  .toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .toolbar__search {
    flex: 1 1 auto;
    max-width: 24rem;
  }
}

.results-summary {
  min-height: 1.25rem;
}

/* Rows that no longer match the filters recede after a beat (a fast reply shouldn't make them
   blink) and lose their colour, so their statuses don't contradict the filter just picked. Only
   the rows: the headings and the bar along their top stay sharp. */
.results :deep(:is(tbody, ul)) {
  transition:
    opacity 200ms,
    filter 200ms;
}

.results--updating :deep(:is(tbody, ul)) {
  opacity: 0.5;
  filter: grayscale(1);
  transition-delay: 150ms;
}
</style>
