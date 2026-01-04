import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    isDark: true, // Default to Dark
    loading: false,
  }),
  actions: {
    toggleDark() {
      this.isDark = !this.isDark
      if (import.meta.client) {
        if (this.isDark) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }
    },
    // Initialize theme
    initTheme() {
      if (import.meta.client) {
        // Force default dark
        this.isDark = true
        document.documentElement.classList.add('dark')

        // Optional: If we want to persist user choice later, we can check localStorage here
      }
    }
  }
})
