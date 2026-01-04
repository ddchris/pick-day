import { defineStore } from 'pinia'

export const useDevStore = defineStore('dev', {
  state: () => ({
    // 'OPEN' | 'CLOSED' | null (auto)
    overrideStatus: null as 'OPEN' | 'CLOSED' | null,
  }),
  actions: {
    setOverrideStatus(status: 'OPEN' | 'CLOSED' | null) {
      this.overrideStatus = status
    }
  }
})
