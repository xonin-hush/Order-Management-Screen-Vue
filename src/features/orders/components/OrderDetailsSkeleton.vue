<script setup lang="ts">
import SkeletonLine from '@/components/ui/SkeletonLine.vue'
import type { OrderStatus } from '../types'
import OrderProgress from './OrderProgress.vue'

/**
 * The details panel's layout before the order arrives. The status the list already knew is
 * drawn for real; only what's still unknown is a placeholder.
 */
defineProps<{ status?: OrderStatus; showActions: boolean; showAmounts: boolean }>()

const ITEM_WIDTHS = [168, 120, 144]
</script>

<template>
  <div class="d-flex flex-column ga-8">
    <div class="d-flex flex-column ga-6">
      <OrderProgress v-if="status && status !== 'cancelled'" :status="status" />
      <div v-if="showActions" class="d-flex align-center ga-2">
        <SkeletonLine :width="168" :height="36" class="skeleton-button rounded-lg" />
        <SkeletonLine :width="80" :height="36" class="skeleton-button rounded-lg" />
        <SkeletonLine :width="140" :height="36" class="skeleton-button rounded-lg ms-auto" />
      </div>
    </div>

    <div>
      <SkeletonLine :width="72" :height="14" class="my-1" />
      <v-card class="mt-3">
        <div class="detail-rows">
          <div v-for="width in [120, 112, 240]" :key="width" class="align-center">
            <SkeletonLine :width="56" />
            <SkeletonLine :width="width" />
          </div>
        </div>
      </v-card>
    </div>

    <div>
      <SkeletonLine :width="64" :height="14" class="my-1" />
      <v-card class="mt-3">
        <v-table density="comfortable">
          <thead>
            <tr>
              <th>Item</th>
              <th class="text-end">{{ showAmounts ? 'Amount' : 'Qty' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="width in ITEM_WIDTHS" :key="width">
              <td class="py-3">
                <SkeletonLine :width="width" />
                <SkeletonLine v-if="showAmounts" :width="96" class="mt-2" />
              </td>
              <td class="py-3 align-top">
                <SkeletonLine :width="showAmounts ? 88 : 16" class="ms-auto" />
              </td>
            </tr>
          </tbody>
          <tfoot v-if="showAmounts" class="bg-surface-light">
            <tr>
              <th class="text-start font-weight-medium">Total</th>
              <td><SkeletonLine :width="96" class="ms-auto" /></td>
            </tr>
          </tfoot>
        </v-table>
      </v-card>
    </div>
  </div>
</template>
