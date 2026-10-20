import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'

/** One look for every form control. */
const field = {
  variant: 'outlined',
  density: 'comfortable',
  color: 'primary',
  // Room for a message only when there is one, so forms don't have gaps under every field.
  hideDetails: 'auto',
} as const

/**
 * Vuetify with the app's theme and component defaults. The defaults are the global styles:
 * a look used in more than one place is set here once, not repeated on each component.
 */
export function createAppVuetify() {
  return createVuetify({
    icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
    theme: {
      // Vuetify 4 follows the OS by default; the app is designed and checked in light only.
      defaultTheme: 'light',
      themes: {
        light: {
          dark: false,
          colors: {
            background: '#FAFAFA',
            surface: '#FFFFFF',
            'surface-bright': '#FFFFFF',
            'surface-light': '#F4F4F5',
            'surface-variant': '#3F3F46',
            'on-surface-variant': '#FAFAFA',
            'on-background': '#18181B',
            'on-surface': '#18181B',
            primary: '#18181B',
            secondary: '#52525B',
            // Text-safe shades: each reaches 4.5:1 on white and on its own tonal tint.
            error: '#B91C1C',
            info: '#1D4ED8',
            success: '#047857',
            warning: '#92400E',
            focus: '#2563EB',
            // Order statuses: categorical colours, always shown next to the status name.
            pending: '#92400E',
            processing: '#1D4ED8',
            shipped: '#6D28D9',
            delivered: '#047857',
            cancelled: '#52525B',
          },
          variables: {
            'border-color': '#18181B',
            // Secondary text at 70% of the text colour still reads at 6:1.
            'medium-emphasis-opacity': 0.7,
          },
        },
      },
    },
    defaults: {
      VBtn: { variant: 'tonal', rounded: 'lg' },
      VTextField: field,
      VTextarea: { ...field, rows: 2, autoGrow: true },
      // Decimals stay as typed ("2.5"), so validation can refuse them; the default precision of
      // 0 would quietly drop the point and turn 2.5 into 25.
      VNumberInput: { ...field, precision: null },
      VSelect: field,
      VCard: { flat: true, border: true, rounded: 'lg' },
      VAlert: { variant: 'tonal', density: 'compact', rounded: 'lg' },
      VChip: { size: 'small', variant: 'tonal' },
    },
  })
}
