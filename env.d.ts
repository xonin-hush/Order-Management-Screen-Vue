/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of a real backend. When unset, the app runs against the in-browser mock API. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
