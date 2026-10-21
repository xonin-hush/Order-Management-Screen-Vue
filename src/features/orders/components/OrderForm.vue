<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import type { VAlert, VBtn } from 'vuetify/components'
import { mdiPlus, mdiTrashCanOutline } from '@mdi/js'
import { errorMessage, isApiError, isCancellation } from '@/api/errors'
import { confirmAction } from '@/components/ui/confirm'
import { bindField, fieldError } from '@/lib/form-field'
import { formatMoney } from '@/lib/format'
import { goBackOr } from '@/lib/navigation'
import { notifySuccess } from '@/lib/notify'
import { matchesFilters, readFilters } from '../filters'
import { useCreateOrder, useUpdateOrder } from '../queries'
import type { OrderInput } from '../schema'
import type { Order } from '../types'
import { emptyItem, lineTotal, useOrderForm } from '../use-order-form'

/** Without `order` this creates a new order; with it, it edits that order. */
const props = defineProps<{ order?: Order }>()

const route = useRoute()
const router = useRouter()
const { mutateAsync: createOrder, isPending: creating } = useCreateOrder()
const { mutateAsync: updateOrder, isPending: updating } = useUpdateOrder()
const { form, items, total, isDirty, submit, setServerErrors } = useOrderForm(props.order, {
  onSubmit: save,
  onInvalid: focusFirstError,
})

const isEdit = computed(() => props.order !== undefined)
const saving = computed(() => creating.value || updating.value)
const formError = ref<string | null>(null)
const saved = ref(false)

// A save can finish after the form is gone (e.g. the session ended): report it, but don't
// navigate from a screen the user has already left.
let mounted = true
onBeforeUnmount(() => {
  mounted = false
})

const formElement = useTemplateRef<HTMLFormElement>('formElement')
const formErrorAlert = useTemplateRef<VAlert>('formErrorAlert')
const addItemButton = useTemplateRef<VBtn>('addItemButton')
const productFieldId = (key: number) => `order-item-${key}-product`

/** Field errors take focus first; otherwise the form-level message (scrolling it into view). */
function focusFirstError() {
  void nextTick(() => {
    const field = formElement.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
    ;(field ?? (formErrorAlert.value?.$el as HTMLElement | undefined))?.focus()
  })
}

async function addItem() {
  const item = emptyItem()
  form.pushFieldValue('items', item)
  await nextTick()
  document.getElementById(productFieldId(item.key))?.focus()
}

async function removeItem(index: number) {
  // Keep focus close to where it was: the next item, else the previous one.
  const { items } = form.state.values
  const neighbour = items[index + 1] ?? items[index - 1]
  await form.removeFieldValue('items', index)
  await nextTick()
  if (neighbour) document.getElementById(productFieldId(neighbour.key))?.focus()
  else (addItemButton.value?.$el as HTMLElement | undefined)?.focus()
}

function backToSource() {
  const { query } = route
  if (props.order) {
    goBackOr(router, { name: 'order-details', params: { id: props.order.id }, query })
  } else {
    goBackOr(router, { name: 'orders', query })
  }
}

function onSubmit() {
  if (saving.value) return
  formError.value = null
  void submit()
}

/** Called by the form with valid input. */
async function save(input: OrderInput) {
  try {
    if (props.order) {
      const order = await updateOrder({ id: props.order.id, input })
      saved.value = true
      notifySuccess(`${order.number} updated`)
      if (mounted) backToSource()
    } else {
      const order = await createOrder(input)
      saved.value = true
      const hidden = !matchesFilters(order, readFilters(route.query))
      notifySuccess(
        `${order.number} created`,
        hidden ? "It's hidden from the list by your current filters." : undefined,
      )
      // Replace the form with the new order's details: Back shouldn't reopen a used form.
      if (mounted) {
        await router.replace({
          name: 'order-details',
          params: { id: order.id },
          query: route.query,
        })
      }
    }
  } catch (error) {
    if (isCancellation(error) || !mounted) return
    formError.value = isApiError(error, 'validation')
      ? setServerErrors(error.fieldErrors).join(' ') || null
      : errorMessage(error)
    focusFirstError()
  }
}

// Closing the panel, Back, or leaving the page shouldn't silently throw work away.
onBeforeRouteLeave((to) => {
  if (to.name === 'login') return true // the session ended; nothing to save it to
  // Mid-save, the outcome isn't known yet: stay until it is (the button shows "Saving…").
  if (saving.value) return false
  if (saved.value || !isDirty.value) return true
  return confirmAction({
    title: 'Discard unsaved changes?',
    description: isEdit.value
      ? `Your changes to ${props.order?.number} haven't been saved.`
      : "This order hasn't been created yet.",
    confirmLabel: 'Discard changes',
    cancelLabel: 'Keep editing',
    tone: 'danger',
  })
})

useEventListener(window, 'beforeunload', (event) => {
  if (isDirty.value && !saved.value) event.preventDefault()
})
</script>

<template>
  <form
    ref="formElement"
    novalidate
    class="side-panel__page"
    :aria-label="isEdit ? `Edit ${order?.number}` : 'New order'"
    @submit.prevent="onSubmit"
  >
    <div class="side-panel__scroll d-flex flex-column ga-8">
      <v-alert v-if="formError" ref="formErrorAlert" type="error" tabindex="-1" class="flex-0-0">
        {{ formError }}
      </v-alert>

      <!-- Said once, rather than starring every label; the fields are also marked `required`
           for screen readers. -->
      <p class="text-body-medium text-medium-emphasis">All fields are required.</p>

      <fieldset>
        <legend class="section-title">Customer</legend>
        <div class="mt-4 d-flex flex-column ga-4">
          <form.Field v-slot="{ field }" name="customer.name">
            <v-text-field
              id="order-customer-name"
              v-bind="bindField(field)"
              required
              label="Full name"
              autocomplete="off"
            />
          </form.Field>
          <form.Field v-slot="{ field }" name="customer.phone">
            <v-text-field
              id="order-customer-phone"
              v-bind="bindField(field)"
              required
              label="Mobile number"
              type="tel"
              autocomplete="off"
              hint="Iraqi mobile number, e.g. 0770 123 4567"
              persistent-hint
            />
          </form.Field>
          <form.Field v-slot="{ field }" name="customer.address">
            <v-textarea
              id="order-customer-address"
              v-bind="bindField(field)"
              required
              label="Delivery address"
              autocomplete="off"
            />
          </form.Field>
        </div>
      </fieldset>

      <form.Field v-slot="{ field: itemsField }" name="items" mode="array">
        <fieldset>
          <legend class="section-title">Items</legend>
          <ol class="mt-4 d-flex flex-column ga-3">
            <!-- The form's store, not itemsField: an array field's slot only re-renders when items
                 are added or removed, so line totals wouldn't follow what is typed.
                 Keyed by position, like the field names: a form.Field keeps the name it was
                 created with, so rows keyed by item would show the wrong item after a removal. -->
            <li v-for="(item, index) in items" :key="index">
              <v-card role="group" :aria-labelledby="`order-item-${item.key}-heading`" class="pa-4">
                <div class="item-heading d-flex align-center justify-space-between ga-3">
                  <h3
                    :id="`order-item-${item.key}-heading`"
                    class="text-body-medium font-weight-medium"
                  >
                    Item {{ index + 1 }}
                  </h3>
                  <v-btn
                    v-if="itemsField.state.value.length > 1"
                    variant="text"
                    size="small"
                    :prepend-icon="mdiTrashCanOutline"
                    :aria-label="`Remove item ${index + 1}`"
                    class="me-n2"
                    @click="removeItem(index)"
                  >
                    Remove
                  </v-btn>
                </div>
                <form.Field v-slot="{ field }" :name="`items[${index}].product`">
                  <v-text-field
                    :id="productFieldId(item.key)"
                    v-bind="bindField(field)"
                    required
                    label="Product"
                    autocomplete="off"
                    class="mt-3"
                  />
                </form.Field>
                <div class="item-numbers mt-4">
                  <form.Field v-slot="{ field }" :name="`items[${index}].quantity`">
                    <v-number-input
                      v-bind="bindField(field)"
                      required
                      label="Quantity"
                      :min="1"
                      control-variant="stacked"
                    />
                  </form.Field>
                  <form.Field v-slot="{ field }" :name="`items[${index}].unitPrice`">
                    <v-number-input
                      v-bind="bindField(field)"
                      required
                      label="Unit price (IQD)"
                      placeholder="e.g. 25,000"
                      :min="0"
                      grouping
                      control-variant="hidden"
                    />
                  </form.Field>
                </div>
                <p class="mt-3 text-end text-body-medium text-medium-emphasis">
                  Line total
                  <span class="ms-1 font-weight-medium text-high-emphasis tabular-nums">
                    {{ lineTotal(item) === null ? '—' : formatMoney(lineTotal(item)!) }}
                  </span>
                </p>
              </v-card>
            </li>
          </ol>
          <p v-if="fieldError(itemsField)" class="mt-3 text-body-medium text-error">
            {{ fieldError(itemsField) }}
          </p>
          <v-btn ref="addItemButton" class="mt-3" :prepend-icon="mdiPlus" @click="addItem">
            Add item
          </v-btn>
        </fieldset>
      </form.Field>
    </div>

    <div class="side-panel__footer d-flex flex-wrap align-center justify-space-between ga-3">
      <p class="text-body-medium text-medium-emphasis">
        Total
        <span class="ms-2 text-title-medium font-weight-semibold text-high-emphasis tabular-nums">
          {{ formatMoney(total) }}
        </span>
      </p>
      <div class="ms-auto d-flex ga-2">
        <v-btn :disabled="saving" @click="backToSource">Cancel</v-btn>
        <v-btn type="submit" variant="flat" color="primary" :loading="saving">
          {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create order' }}
        </v-btn>
      </div>
    </div>
  </form>
</template>

<style scoped>
.item-heading {
  min-height: 32px;
}

.item-numbers {
  display: grid;
  grid-template-columns: 8rem 1fr;
  /* Not stretched: an error under one field would make the other one taller. */
  align-items: start;
  gap: 12px;
}

/* Below 360px (small phones, 400% zoom) side by side cut off "Unit price (IQD)" and the price. */
@media (max-width: 359.98px) {
  .item-numbers {
    grid-template-columns: 1fr;
  }
}
</style>
