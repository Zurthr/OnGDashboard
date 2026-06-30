// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-06-20',
  devtools: { enabled: true },
  
  modules: [
    '@pinia/nuxt',
    '@nuxt/icon'
  ],

  css: [
    '~/assets/css/main.css'
  ],

  build: {
    transpile: [/echarts/, 'vue-echarts', 'resize-detector']
  }
})
