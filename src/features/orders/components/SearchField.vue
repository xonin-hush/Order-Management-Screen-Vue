<script setup lang="ts">
import { useTemplateRef } from 'vue'
import type { VTextField } from 'vuetify/components'
import { mdiClose, mdiMagnify } from '@mdi/js'

const model = defineModel<string>({ required: true })

defineProps<{
  /** Results for the current text are on their way. */
  searching?: boolean
}>()

const emit = defineEmits<{
  /** Enter, or clearing the field: apply now instead of waiting for the debounce. */
  submit: [value: string]
}>()

const field = useTemplateRef<VTextField>('field')

function clear() {
  model.value = ''
  emit('submit', '')
  field.value?.focus()
}
</script>

<template>
  <form role="search" @submit.prevent="emit('submit', model)">
    <v-text-field
      id="order-search"
      ref="field"
      v-model="model"
      type="search"
      aria-label="Search orders"
      placeholder="Customer or order number"
      enterkeyhint="search"
      autocomplete="off"
      spellcheck="false"
      density="compact"
      :prepend-inner-icon="mdiMagnify"
      class="search-field"
    >
      <template #append-inner>
        <v-progress-circular v-if="searching" indeterminate size="16" width="2" color="secondary" />
        <v-btn
          v-if="model"
          :icon="mdiClose"
          variant="text"
          size="small"
          density="comfortable"
          aria-label="Clear search"
          @click="clear"
        />
      </template>
    </v-text-field>
  </form>
</template>

<style scoped>
/* The field has its own clear button. */
.search-field :deep(input::-webkit-search-cancel-button) {
  appearance: none;
}
</style>
