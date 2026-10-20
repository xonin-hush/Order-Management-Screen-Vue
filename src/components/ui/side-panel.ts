import type { InjectionKey } from 'vue'

export interface SidePanelContext {
  /** The panel's name and description come from these elements (in SidePanelHeader). */
  titleId: string
  descriptionId: string
  close: () => void
}

/** Provided by SidePanel to whatever it shows: the header names it, any button can close it. */
export const sidePanelKey: InjectionKey<SidePanelContext> = Symbol('side-panel')
