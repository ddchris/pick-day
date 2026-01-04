// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },
  modules: [
    '@pinia/nuxt',
    '@unocss/nuxt',
  ],
  runtimeConfig: {
    // Private keys (server-side only)
    firebaseServiceAccount: '',
    lineChannelAccessToken: '',
    lineChannelSecret: '',
    public: {
      // Public keys (client-side)
      firebaseApiKey: '',
      firebaseAuthDomain: '',
      firebaseProjectId: '',
      firebaseStorageBucket: '',
      firebaseMessagingSenderId: '',
      firebaseAppId: '',
      firebaseMeasurementId: '',
      liffId: '',
      adminUserIds: '', // Comma-separated LINE User IDs
    }
  },
  devServer: {
    host: '0.0.0.0',   // 允許外部訪問
    port: 3001
  },
  vite: {
    server: {
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'], // 允許 ngrok 子域名
      hmr: {
        port: 24678, // 可選
      }
    }
  }
})
