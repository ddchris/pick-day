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

        // Set GroupId
        let detectedId: string | null = null
        if (context?.type === 'group' || context?.type === 'room') {
          detectedId = context.groupId || context.roomId || null
        }

        if (detectedId && isValidGroupId(detectedId)) {
          this.groupId = detectedId
          console.log('[User Store] ✅ Valid Group/Room ID set:', this.groupId)
        } else if (detectedId) {
          console.warn('[User Store] ❌ Detected ID format invalid:', detectedId)
        } else {
          console.warn('[User Store] ⚠️ No Group/Room ID in context. Context Type:', context?.type)
        }

        // URL Fallback (Highest Priority for specific links)
        if (!this.groupId) {
          const qId = route.query.groupId as string
          if (qId && isValidGroupId(qId)) {
            this.groupId = qId
            console.log('[User Store] ✅ Group ID set from valid URL Query:', this.groupId)
          }
        }

        // --- ID MAPPING SYNC ---
        // If we have both a UUID from context AND a real ID from URL, sync them!
        const qId = route.query.groupId as string
        if (detectedId && qId && detectedId !== qId && isValidGroupId(detectedId) && isValidGroupId(qId)) {
          console.log('[User Store] 🔄 Detected ID mismatch. Syncing UUID -> Real ID mapping...')
          $fetch('/api/admin/sync-group-mapping', {
            method: 'POST',
            body: { liffGroupId: detectedId, realGroupId: qId }
          }).catch(err => console.error('[User Store] Sync Mapping Failed:', err))
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
