import { shallowRef } from 'vue'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel: string
  /** Label for the safe choice. Avoid plain "Cancel" when the action itself is "Cancel order". */
  cancelLabel?: string
  tone?: 'danger' | 'neutral'
}

interface PendingConfirmation {
  options: ConfirmOptions
  resolve: (confirmed: boolean) => void
}

/** The confirmation currently on screen; rendered by ConfirmDialogHost. */
export const pendingConfirmation = shallowRef<PendingConfirmation | null>(null)

/** Resolves to the user's answer, so route guards can `await` it too. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  settleConfirmation(false) // a new request replaces any unanswered one
  return new Promise((resolve) => {
    pendingConfirmation.value = { options, resolve }
  })
}

export function settleConfirmation(confirmed: boolean) {
  const pending = pendingConfirmation.value
  pendingConfirmation.value = null
  pending?.resolve(confirmed)
}
