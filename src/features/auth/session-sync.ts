import { useEventListener } from '@vueuse/core'
import { TOKEN_STORAGE_KEY, useSessionStore } from './session.store'

/** Another tab signed in or out: reload, so this tab never keeps acting as the previous user. */
export function useSessionSync() {
  const session = useSessionStore()
  useEventListener(window, 'storage', (event) => {
    const tokenChanged = event.key === TOKEN_STORAGE_KEY || event.key === null // null: storage cleared
    if (tokenChanged && event.newValue !== session.token) window.location.reload()
  })
}
