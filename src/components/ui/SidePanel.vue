<script setup lang="ts">
import { nextTick, provide, useId, useTemplateRef, watch } from 'vue'
import { sidePanelKey } from './side-panel'

/**
 * Route-driven modal drawer. Vuetify's dialog handles the focus trap, Escape and scroll lock;
 * this adds where focus goes on open and close, since there's no trigger button to return to.
 */
const props = defineProps<{
  open: boolean
  /** Changes when the panel swaps content (e.g. details → edit) so focus follows the new heading. */
  contentKey?: string
  /** Moves focus somewhere sensible after closing. */
  returnFocus?: () => void
}>()

const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const descriptionId = useId()
provide(sidePanelKey, { titleId, descriptionId, close: () => emit('close') })

const body = useTemplateRef<HTMLElement>('body')

/**
 * Start on the heading: screen readers announce what opened, and a stray Enter can't trigger
 * an action (focusing the first control would).
 */
function focusHeading() {
  body.value?.querySelector<HTMLElement>('[data-panel-heading]')?.focus({ preventScroll: true })
}

/** Unless the user is already inside: e.g. they clicked a field while the panel slid in. */
function onAfterEnter() {
  if (!body.value?.contains(document.activeElement)) focusHeading()
}

watch(
  () => props.contentKey,
  async (key, previousKey) => {
    if (!props.open || previousKey === undefined || key === previousKey) return
    await nextTick()
    // On short screens the whole panel scrolls; new content starts at its top.
    if (body.value) body.value.scrollTop = 0
    focusHeading()
  },
)

// The focus trap wraps focus (last → first) without scrolling; on short screens, where the
// panel itself scrolls, that could leave the focused control out of sight.
function revealFocused(event: FocusEvent) {
  ;(event.target as HTMLElement).scrollIntoView({ block: 'nearest' })
}
</script>

<template>
  <!-- The route opens and closes it, so the browser's Back button is left to the router. -->
  <v-dialog
    :model-value="open"
    class="side-panel"
    location="end"
    transition="side-panel"
    :close-on-back="false"
    :aria-labelledby="titleId"
    :aria-describedby="descriptionId"
    @update:model-value="(value: boolean) => !value && emit('close')"
    @after-enter="onAfterEnter"
    @after-leave="returnFocus?.()"
  >
    <div ref="body" class="side-panel__body" @focusin="revealFocused">
      <slot />
    </div>
  </v-dialog>
</template>

<style>
/*
 * Not scoped: the dialog is teleported out of this component. The page, scroll and footer
 * classes are the layout contract for whatever the panel shows (details, create, edit).
 */
.v-dialog.side-panel > .v-overlay__content {
  width: 100%;
  max-width: 36rem;
  height: 100%;
  max-height: 100%;
  margin: 0;
  border-radius: 0;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 0 2rem rgb(0 0 0 / 0.16);
}

.side-panel-enter-active {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Leaving is quicker, and accelerates away: the user is already done with it. */
.side-panel-leave-active {
  transition: transform 160ms cubic-bezier(0.4, 0, 1, 1);
}

.side-panel-enter-from,
.side-panel-leave-to {
  transform: translateX(100%);
}

.v-locale--is-rtl > .side-panel-enter-from,
.v-locale--is-rtl > .side-panel-leave-to {
  transform: translateX(-100%);
}

/* Swapping what the panel shows (details → edit) fades the new content in. */
.side-panel__body > .side-panel__page {
  animation: fade-in 180ms ease-out;
}

.side-panel__body,
.side-panel__page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.side-panel__body {
  height: 100%;
}

.side-panel__page,
.side-panel__scroll {
  flex: 1 1 auto;
}

.side-panel__scroll {
  min-height: 0;
  overflow-y: auto;
  padding: 24px 20px;
}

.side-panel__footer {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 16px 20px;
}

@media (min-width: 600px) {
  .side-panel__scroll,
  .side-panel__footer {
    padding-inline: 24px;
  }
}

/* Very short viewports (landscape phones, 400% zoom): the panel scrolls as a whole instead of
   pinning its header and footer around a sliver of content. */
@media (max-height: 30rem) {
  .side-panel__body {
    overflow-y: auto;
  }

  .side-panel__page,
  .side-panel__scroll {
    flex: none;
    overflow: visible;
  }
}
</style>
