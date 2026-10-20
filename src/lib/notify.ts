import { mdiAlertCircleOutline, mdiCheckCircleOutline } from '@mdi/js'
import { ref } from 'vue'
import { errorMessage, isCancellation } from '@/api/errors'

interface Notification {
  title: string
  text?: string
  prependIcon: string
  /** Milliseconds on screen; -1 keeps it until dismissed. Vuetify's default is 5 s. */
  timeout?: number
}

/** Waiting to be shown; rendered by the snackbar queue in App.vue. */
export const notifications = ref<Notification[]>([])

/** Changes whenever everything is dismissed, so the queue can drop what's on screen too. */
export const notificationsGeneration = ref(0)

/**
 * Reports a failed action. Cancelled requests (e.g. after signing out) aren't failures.
 * Errors stay until dismissed: they say what to do next, and keyboard users can't reach a toast
 * to pause it while focus is trapped in a panel.
 */
export function notifyError(title: string, error: unknown) {
  if (isCancellation(error)) return
  notifications.value.push({
    title,
    text: errorMessage(error),
    prependIcon: mdiAlertCircleOutline,
    timeout: -1,
  })
}

export function notifySuccess(title: string, text?: string) {
  notifications.value.push({ title, text, prependIcon: mdiCheckCircleOutline })
}

/** Messages about one user's work mean nothing to the next one. */
export function dismissNotifications() {
  notifications.value = []
  notificationsGeneration.value++
}
