// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-06-20',
  devtools: { enabled: true },

  experimental: {
    appManifest: false
  },

  modules: [
    '@pinia/nuxt',
    '@nuxt/icon'
  ],

  css: [
    '~/assets/css/main.css'
  ],

  build: {
    transpile: [/echarts/, 'vue-echarts', 'resize-detector']
  },

  // Puppeteer runs server-side only — exclude from client bundle
  nitro: {
    externals: {
      external: ['puppeteer']
    }
  },

  // Nuxt's unimport scanner misparses numeric index types in useKkksDeviations
  // and generates an invalid `import { 1 }` binding. Exclude it from scanning.
  // All usages already use explicit imports, so no auto-import is needed.
  ignore: [
    '**/useKkksDeviations*'
  ]
})
