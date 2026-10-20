<script setup lang="ts">
import AppHeader from './AppHeader.vue'

// Focus the content directly rather than following the #hash, which would leak into the URL.
function skipToContent() {
  document.getElementById('main')?.focus()
}
</script>

<template>
  <a href="#main" class="skip-link d-sr-only-focusable" @click.prevent="skipToContent">
    Skip to main content
  </a>
  <AppHeader />
  <v-main id="main" tabindex="-1">
    <v-container max-width="1280" class="px-4 px-sm-6 px-lg-8 pt-6 pt-sm-8 pb-16">
      <RouterView />
    </v-container>
  </v-main>
</template>

<style scoped>
.skip-link:focus {
  position: fixed;
  top: 12px;
  inset-inline-start: 16px;
  z-index: 2000;
  padding: 8px 16px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.16);
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
