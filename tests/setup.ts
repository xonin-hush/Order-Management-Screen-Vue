import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/vue'
import { afterEach, beforeEach } from 'vitest'
import { dismissNotifications } from '@/lib/notify'
import { armFailure } from '@/mocks/failures'

/**
 * A fresh in-memory localStorage per test. Recent Node versions ship their own global
 * `localStorage`, which can shadow jsdom's, so tests don't rely on either.
 */
class MemoryStorage {
  #items = new Map<string, string>()

  get length() {
    return this.#items.size
  }
  clear() {
    this.#items.clear()
  }
  getItem(key: string) {
    return this.#items.get(key) ?? null
  }
  key(index: number) {
    return [...this.#items.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.#items.delete(key)
  }
  setItem(key: string, value: string) {
    this.#items.set(key, String(value))
  }
}

beforeEach(() => {
  armFailure('off')
  dismissNotifications()
  const storage = new MemoryStorage() as unknown as Storage
  for (const target of new Set([globalThis, window])) {
    Object.defineProperty(target, 'localStorage', { value: storage, configurable: true })
  }
})

// Testing Library only auto-cleans up when test globals are enabled.
afterEach(() => cleanup())

// Browser APIs jsdom doesn't implement but the UI (or Vuetify) relies on.
// Layout: tests run at desktop width unless a test overrides matchMedia.
window.matchMedia = (query: string) =>
  ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// No visual viewport (pinch zoom) in jsdom: Vuetify's overlays then use the layout viewport.
for (const target of new Set([globalThis, window])) {
  Object.defineProperty(target, 'visualViewport', { value: null, configurable: true })
}

window.scrollTo = () => {}
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.releasePointerCapture ??= () => {}
