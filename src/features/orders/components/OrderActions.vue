<script setup lang="ts">
import { computed, nextTick, useId } from 'vue'
import { useRoute } from 'vue-router'
import { mdiCancel, mdiLockOutline, mdiPencilOutline } from '@mdi/js'
import { confirmAction } from '@/components/ui/confirm'
import { useSessionStore } from '@/features/auth/session.store'
import { notifyError, notifySuccess } from '@/lib/notify'
import { isFinal, nextStatuses, STATUS_LABELS } from '../domain'
import { EDIT_ORDER_PERMISSIONS } from '../permissions'
import { useCancelOrder, useChangeOrderStatus } from '../queries'
import type { Order, OrderStatus } from '../types'

const props = defineProps<{ order: Order }>()

const route = useRoute()
const session = useSessionStore()
const {
  mutateAsync: changeStatus,
  isPending: changingStatus,
  variables: statusChange,
} = useChangeOrderStatus()
const { mutateAsync: cancelOrder, isPending: cancelling } = useCancelOrder()

// No permission → not rendered. Permitted but the order is final → shown as unavailable, with
// the reason (see README: hidden vs disabled).
const final = computed(() => isFinal(props.order.status))
const canChangeStatus = computed(() => session.can('orders.update_status'))
const canCancel = computed(() => session.can('orders.cancel'))
const canEdit = computed(() => session.canAll(EDIT_ORDER_PERMISSIONS))
const hasActions = computed(() => canEdit.value || canChangeStatus.value || canCancel.value)
const advanceTo = computed(() => (canChangeStatus.value ? nextStatuses(props.order.status) : []))
const busy = computed(() => changingStatus.value || cancelling.value)

const finalNoteId = useId()
const finalNote = computed(() =>
  props.order.status === 'delivered'
    ? "Delivered orders are final: they can't be edited, moved to another status or cancelled."
    : "Cancelled orders are final: they can't be edited or reopened.",
)

/** If the button the user pressed is gone (e.g. no further status), keep focus in the panel. */
function keepFocusInPanel(button: HTMLElement) {
  void nextTick(() => {
    if (!button.isConnected) document.querySelector<HTMLElement>('[data-panel-heading]')?.focus()
  })
}

async function advance(status: OrderStatus, event: MouseEvent) {
  const button = event.currentTarget as HTMLElement
  const { id, number } = props.order
  const label = STATUS_LABELS[status].toLowerCase()

  if (isFinal(status)) {
    const confirmed = await confirmAction({
      title: `Mark ${number} as ${label}?`,
      description: `${STATUS_LABELS[status]} orders are final: they can no longer be edited or cancelled.`,
      confirmLabel: `Mark as ${label}`,
      cancelLabel: 'Not yet',
    })
    if (!confirmed) return
  }

  // mutateAsync rather than mutate callbacks: the outcome is reported even if the panel closes.
  try {
    await changeStatus({ id, status })
    notifySuccess(`${number} marked as ${label}`)
    keepFocusInPanel(button)
  } catch (error) {
    notifyError(`Couldn't update ${number}`, error)
  }
}

async function confirmCancel(event: MouseEvent) {
  const button = event.currentTarget as HTMLElement
  const { id, number, customer } = props.order

  const confirmed = await confirmAction({
    title: `Cancel ${number}?`,
    description: `${customer.name}'s order will be cancelled. This can't be undone.`,
    confirmLabel: 'Cancel order',
    // Not "Cancel": that would be ambiguous next to "Cancel order".
    cancelLabel: 'Keep order',
    tone: 'danger',
  })
  if (!confirmed) return

  try {
    await cancelOrder({ id })
    notifySuccess(`${number} cancelled`)
    keepFocusInPanel(button)
  } catch (error) {
    notifyError(`Couldn't cancel ${number}`, error)
  }
}
</script>

<template>
  <section v-if="hasActions" aria-label="Order actions" class="d-flex flex-column ga-3">
    <div v-if="canEdit || advanceTo.length || canCancel" class="d-flex flex-wrap align-center ga-2">
      <!-- Final orders: still focusable and announced with the reason (aria-disabled), but
           inert: no link to follow, and clicks are ignored. -->
      <v-btn
        v-if="canEdit"
        :to="
          final ? undefined : { name: 'order-edit', params: { id: order.id }, query: route.query }
        "
        replace
        :prepend-icon="mdiPencilOutline"
        :aria-disabled="final || undefined"
        :aria-describedby="final ? finalNoteId : undefined"
        :class="{ unavailable: final }"
        :disabled="busy"
      >
        Edit
      </v-btn>
      <!-- Keyed by position, so the same button (and its focus) carries on to the next step. -->
      <v-btn
        v-for="(status, index) in advanceTo"
        :key="index"
        variant="flat"
        color="primary"
        :loading="changingStatus && statusChange?.status === status"
        :disabled="busy && !changingStatus"
        @click="advance(status, $event)"
      >
        Mark as {{ STATUS_LABELS[status].toLowerCase() }}
      </v-btn>
      <v-btn
        v-if="canCancel"
        color="error"
        :prepend-icon="mdiCancel"
        :aria-disabled="final || undefined"
        :aria-describedby="final ? finalNoteId : undefined"
        :class="{ unavailable: final }"
        :loading="cancelling"
        :disabled="busy && !cancelling"
        @click="!final && confirmCancel($event)"
      >
        Cancel order
      </v-btn>
    </div>
    <v-alert
      v-if="final"
      :id="finalNoteId"
      role="note"
      color="secondary"
      :icon="mdiLockOutline"
      class="text-body-medium"
    >
      {{ finalNote }}
    </v-alert>
  </section>
</template>

<style scoped>
/* Unavailable rather than disabled: it stays focusable so the reason can be read. */
.unavailable {
  opacity: var(--v-disabled-opacity);
  cursor: not-allowed;
}
</style>
