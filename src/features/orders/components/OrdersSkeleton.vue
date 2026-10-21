<script setup lang="ts">
import SkeletonLine from '@/components/ui/SkeletonLine.vue'

defineProps<{ compact: boolean; showAmounts: boolean }>()

const ROWS = 8
/** Customer names vary in length; a skeleton of identical bars reads as a pattern, not text. */
const NAME_WIDTHS = [128, 96, 144, 112, 88, 136, 104, 120]
</script>

<template>
  <!-- Mirrors the real table and list, cell for cell, so nothing moves when the orders arrive.
       One polite status for screen readers instead of the loaders' own announcements. -->
  <div role="status">
    <span class="d-sr-only">Loading orders…</span>
    <v-card aria-hidden="true">
      <ul v-if="compact">
        <li v-for="row in ROWS" :key="row" class="skeleton-row px-4 py-3">
          <span class="d-flex align-center justify-space-between ga-3">
            <SkeletonLine :width="68" />
            <SkeletonLine :width="84" :height="24" class="rounded-pill" />
          </span>
          <span class="d-flex align-center mt-1 line">
            <SkeletonLine :width="NAME_WIDTHS[row - 1]" />
          </span>
          <span class="d-flex align-center justify-space-between ga-3 mt-1 line">
            <SkeletonLine :width="104" />
            <SkeletonLine v-if="showAmounts" :width="84" />
          </span>
        </li>
      </ul>
      <v-table v-else>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Date</th>
            <th>Status</th>
            <th v-if="showAmounts" class="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in ROWS" :key="row">
            <td><SkeletonLine :width="76" /></td>
            <td class="w-100"><SkeletonLine :width="NAME_WIDTHS[row - 1]" /></td>
            <td><SkeletonLine :width="112" /></td>
            <td><SkeletonLine :width="84" :height="24" class="rounded-pill" /></td>
            <td v-if="showAmounts"><SkeletonLine :width="92" class="ms-auto" /></td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </div>
</template>

<style scoped>
.skeleton-row + .skeleton-row {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

/* The height of a line of body text, like the row it stands in for. */
.line {
  height: 1.25rem;
}
</style>
