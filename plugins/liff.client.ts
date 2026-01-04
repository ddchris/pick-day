import liff from '@line/liff'

export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  const config = useRuntimeConfig()
  const liffId = config.public.liffId

  if (!liffId) {
    console.error('[LIFF Plugin] LIFF ID is missing in runtime config')
    return
  }

  // --- EARLY CAPTURE: Grab groupId before LIFF/Nuxt eats it ---
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const urlGroupId = params.get('groupId')
    // Check if it looks like a stable ID
    if (urlGroupId && (urlGroupId.startsWith('C') || urlGroupId.startsWith('R')) && urlGroupId.length > 30) {
      console.log('[LIFF Plugin] ⚡ Early captured groupId from URL:', urlGroupId)
      localStorage.setItem('stableGroupId', urlGroupId)
    }
  }

  // Early initialization
  // Note: We don't await here because we don't want to block the whole app,
  // but stores will await userStore.initLiff() which will wait for this?
  // Actually, we'll store the promise or just handle it in the store.

  const liffInitPromise = liff.init({ liffId })
    .then(() => {
      console.log('[LIFF Plugin] Early Init Success')
      return liff
    })
    .catch((err) => {
      console.error('[LIFF Plugin] Early Init Failed', err)
      throw err
    })

  return {
    provide: {
      liffInit: liffInitPromise
    }
  }
})
