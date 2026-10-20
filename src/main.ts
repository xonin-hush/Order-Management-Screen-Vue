import '@fontsource-variable/inter'
// Vuetify's styles without its palette classes (bg-red-lighten-2…): colours come from the theme.
import 'vuetify/styles/core'
import 'vuetify/styles/utilities'
import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import { createAppVuetify } from './plugins/vuetify'

createApp(App).use(createAppVuetify()).mount('#app')
