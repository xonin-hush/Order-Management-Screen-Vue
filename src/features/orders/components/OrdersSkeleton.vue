<script setup lang="ts">
defineProps<{ compact: boolean }>()

const ROWS = 8
</script>

<template>
  <!-- Mirrors the real layout so content doesn't jump when it arrives. One polite status for
       screen readers instead of the loaders' own announcements. -->
  <div role="status">
    <span class="d-sr-only">Loading orders…</span>
    <div aria-hidden="true">
      <ul v-if="compact" class="d-flex flex-column ga-2">
        <li v-for="row in ROWS" :key="row">
          <v-card><v-skeleton-loader type="list-item-two-line" /></v-card>
        </li>
      </ul>
      <v-card v-else>
        <v-skeleton-loader :type="`table-thead, table-row-divider@${ROWS}`" />
      </v-card>
    </div>
  </div>
</template>
