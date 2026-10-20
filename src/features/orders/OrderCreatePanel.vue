<script setup lang="ts">
import SidePanelHeader from '@/components/ui/SidePanelHeader.vue'
import OrderForm from './components/OrderForm.vue'
</script>

<template>
  <div class="side-panel__page">
    <SidePanelHeader title="New order">
      <template #description>Add the customer's details and what they ordered.</template>
    </SidePanelHeader>
    <OrderForm />
  </div>
</template>
