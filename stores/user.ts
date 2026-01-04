import { defineStore } from 'pinia'
import liff from '@line/liff'
import { signInWithCustomToken } from 'firebase/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    profile: null as null | { userId: string; displayName: string; pictureUrl?: string },
    groupId: null as string | null,
    idToken: null as string | null,
    isAuthenticated: false,
    isAdmin: false,
    mockMode: false,
    isInLineClient: false,
    isExternalBrowser: false,
    isInitializing: true, // Start as true
    initError: null as string | null,
    debugInfo: null as any,
  }),

  actions: {
    async initLiff() {
      const config = useRuntimeConfig()
      const { $liffInit } = useNuxtApp()
      const route = useRoute()

      try {
        this.isInitializing = true

        // --- Mock Mode Check ---
        if (route.query.mockGroupId && route.query.mockUserId) {
          this.mockMode = true
          this.groupId = route.query.mockGroupId as string
          this.profile = { userId: route.query.mockUserId as string, displayName: 'Mock User', pictureUrl: '' }
          console.log('Mock Mode Activated:', this.profile, this.groupId)
          return
        }

        // --- Wait for LIFF Plugin Init ---
        if (!$liffInit) {
          throw new Error('LIFF Plugin not found or failed to provide liffInit')
        }

        console.log('[User Store] Waiting for LIFF Early Init...')
        await $liffInit
        console.log('[User Store] LIFF Init confirmed. UserAgent:', navigator.userAgent)

        this.isInLineClient = liff.isInClient()
        this.isExternalBrowser = !liff.isInClient()

        console.log('[User Store] isInClient:', this.isInLineClient)

        // Force Login if external browser and not logged in
        if (!liff.isLoggedIn()) {
          console.log('[User Store] Not logged in, triggering login flow...')
          liff.login()
          return
        }

        console.log('[User Store] Logged in. Fetching profile...')
        const profile = await liff.getProfile()
        this.profile = {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        }

        const context = liff.getContext()
        console.log('[User Store] === LIFF Context Debug ===')
        console.log('[User Store] Context Type:', context?.type)
        console.log('[User Store] Raw Context:', JSON.stringify(context, null, 2))

        // Save user profile to Firestore
        try {
          const { db } = useNuxtApp().$firebase
          const { doc, setDoc } = await import('firebase/firestore')
          await setDoc(doc(db, 'users', this.profile.userId), {
            userId: this.profile.userId,
            displayName: this.profile.displayName,
            pictureUrl: this.profile.pictureUrl || '',
            updatedAt: Date.now()
          }, { merge: true })
          console.log('[User Store] ✅ Profile saved to Firestore')
        } catch (e) {
          console.error('[User Store] Failed to save profile:', e)
        }

        this.debugInfo = {
          type: context?.type,
          groupId: context?.groupId,
          roomId: context?.roomId,
          userId: this.profile?.userId,
          liffId: config.public.liffId,
          viewType: context?.viewType,
          endpointUrl: context?.endpointUrl,
          isInClient: this.isInLineClient,
          rawContext: context // Keep full object for deep debug
        }

        // Helper to validate LINE Group IDs (Could be C/R + 32 hex OR a 36-char UUID)
        const isValidGroupId = (id: string | null) => {
          if (!id) return false
          // Mock IDs are allowed for dev
          return /^([CR][0-9a-fA-F]{32}|[0-9a-fA-F-]{36})$/i.test(id) || id.startsWith('mock-')
        }

        // --- ID DETECTION LOGIC (Strict Priority) ---
        // 1. Try Nuxt Route Query
        let qId = route.query.groupId as string

        // 2. Fallback: Manual URL Parsing (window.location)
        if (!qId && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          qId = urlParams.get('groupId') as string
          if (!qId) {
            // Try Hash params just in case
            const hash = window.location.hash
            if (hash.includes('?')) {
              const hashParams = new URLSearchParams(hash.split('?')[1])
              qId = hashParams.get('groupId') as string
            }
          }
        }

        const cId = context?.groupId || context?.roomId || null

        // Relaxed Check: Just C/R + length > 30 (to be safe)
        const isStable = (id: string | null) => !!id && (id.startsWith('C') || id.startsWith('R')) && id.length > 30

        // Check LocalStorage for previously known Stable ID
        const storedStableId = localStorage.getItem('stableGroupId')

        let finalId: string | null = null

        // 1. Highest Priority: Stable ID from URL (provided by Bot)
        if (isStable(qId)) {
          finalId = qId
          console.log('[User Store] ✅ Using Stable Group ID from URL:', finalId)
          // Persist it!
          localStorage.setItem('stableGroupId', finalId)
        }
        // 2. Second Priority: Stable ID from Native Context
        else if (isStable(cId)) {
          finalId = cId!
          console.log('[User Store] ✅ Using Stable Group ID from Native Context:', finalId)
          // Persist it!
          localStorage.setItem('stableGroupId', finalId)
        }
        // 3. Recovery Priority: Previously stored Stable ID (if current context is unstable)
        else if (storedStableId && isValidGroupId(cId)) { // If we are in *some* group context
          finalId = storedStableId
          console.log('[User Store] ♻️ Restored Stable Group ID from Storage:', finalId)
        }
        // 4. Third Priority: Unstable UUID from Context (Last Resort)
        else if (isValidGroupId(cId)) {
          finalId = cId
          console.log('[User Store] ⚠️ Using Potentially Unstable UUID from Context:', finalId)
        }
        // 5. Fallback: Any valid format from URL
        else if (isValidGroupId(qId)) {
          finalId = qId
          console.log('[User Store] ⚠️ Using ID from URL Fallback:', finalId)
        }

        this.groupId = finalId

        // Update Debug Info
        this.debugInfo = {
          ...this.debugInfo,
          routeQuery: route.query, // <--- Add this for debugging
          activeIdSource: finalId === qId ? 'URL' : finalId === storedStableId ? 'Storage' : 'Context'
        }

        // --- ID MAPPING SYNC ---
        // If we have both a UUID from context AND a real ID from URL, sync them!
        if (isStable(qId) && cId && cId !== qId && isValidGroupId(cId)) {
          console.log('[User Store] 🔄 Mismatch found. Syncing temporary UUID -> Stable ID mapping...')
          $fetch('/api/admin/sync-group-mapping', {
            method: 'POST',
            body: { liffGroupId: cId, realGroupId: qId }
          }).catch(err => console.error('[User Store] Sync Mapping Failed:', err))
        }

        if (!this.groupId) {
          console.warn('[User Store] ⚠️ No valid Group ID detected.')
        }

        this.idToken = liff.getIDToken()
        console.log('[LIFF] ID Token obtained')

        // Immediate Global Admin Check (Env)
        const envAdminIds = config.public.adminUserIds || ''
        const envList = envAdminIds.split(',').map(id => id.trim()).filter(Boolean)
        if (envList.includes(this.profile.userId)) {
          this.isAdmin = true
          console.log('[LIFF] Global Admin detected from Env')
        }

        // --- Firebase Auth ---
        if (this.idToken) {
          await this.loginToFirebase(this.idToken)

          // Auto-initialize group admins and check admin status
          if (this.isAuthenticated) {
            await this.checkAndInitializeAdmin()
          }
        }

      } catch (error: any) {
        console.error('LIFF Init Failed', error)
        this.initError = error.message || JSON.stringify(error)
      } finally {
        this.isInitializing = false
      }
    },

    async loginToFirebase(idToken: string) {
      try {
        const { token } = await $fetch<{ token: string }>('/api/auth/login', {
          method: 'POST',
          body: {
            idToken,
            liffContext: this.debugInfo // Send LIFF context for server-side debugging
          }
        })

        if (token) {
          const auth = useFirebaseAuth()
          await signInWithCustomToken(auth, token)
          this.isAuthenticated = true
        }
      } catch (error) {
        console.error('Firebase Login Failed', error)
      }
    },

    async checkAndInitializeAdmin() {
      if (!this.profile?.userId) return

      // 1. Check Global Admin (Env)
      const config = useRuntimeConfig()
      const envAdminIds = config.public.adminUserIds || ''
      const envList = envAdminIds.split(',').map(id => id.trim()).filter(Boolean)

      if (envList.includes(this.profile.userId)) {
        this.isAdmin = true
        console.log('Admin status (Env Match):', true)
      }

      // 2. Check Group Admin (Firestore)
      if (this.groupId) {
        try {
          // Initialize group if needed
          await $fetch('/api/admin/init-group', {
            method: 'POST',
            body: { groupId: this.groupId }
          })

          // Check Firestore
          const { db } = useNuxtApp().$firebase
          const { doc, getDoc } = await import('firebase/firestore')
          const groupRef = doc(db, 'groups', this.groupId)
          const snap = await getDoc(groupRef)

          if (snap.exists()) {
            const data = snap.data()
            const adminIds = data.adminIds || []
            if (adminIds.includes(this.profile.userId)) {
              this.isAdmin = true
              console.log('Admin status (Group):', true)
            }
          }
        } catch (error) {
          console.log('Group admin check failed:', error)
        }
      }
    }
  }
})
