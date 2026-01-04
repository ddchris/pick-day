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
      const { $toast } = useNuxtApp() // Assuming we add a toast plugin later or use a store action

      try {
        // --- Mock Mode Check ---
        const route = useRoute()
        if (route.query.mockGroupId && route.query.mockUserId) {
          this.mockMode = true
          this.groupId = route.query.mockGroupId as string
          this.profile = {
            userId: route.query.mockUserId as string,
            displayName: 'Mock User',
            pictureUrl: '',
          }
          // For mock mode, we might skip firebase auth or force a mock login
          console.log('Mock Mode Activated:', this.profile, this.groupId)
          return
        }

        // --- Real LIFF Init ---
        if (!config.public.liffId) {
          throw new Error('LIFF ID is missing in config')
        }

        await liff.init({ liffId: config.public.liffId })

        this.isInLineClient = liff.isInClient()
        this.isExternalBrowser = !liff.isInClient()

        if (!liff.isLoggedIn()) {
          // If in external browser, we might want to login to get profile, 
          // but we won't get groupId.
          liff.login()
          return
        }

        const profile = await liff.getProfile()
        this.profile = {
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        }

        const context = liff.getContext()
        console.log('[LIFF] === LIFF Context Debug ===')
        console.log('[LIFF] Full Context:', JSON.stringify(context, null, 2))
        console.log('[LIFF] Context Type:', context?.type)
        console.log('[LIFF] Group ID:', context?.groupId)
        console.log('[LIFF] Room ID:', context?.roomId)

        // Save user profile to Firestore (for push notifications)
        // Do this BEFORE login attempt so names appear correctly even if login fails
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
          accessTokenHash: context?.accessTokenHash,
          availability: context?.availability,
          scope: context?.scope,
          menuColorSetting: context?.menuColorSetting,
          utsTracking: context?.utsTracking,
          miniDomainAllowed: context?.miniDomainAllowed,
          isIapSandbox: context?.isIapSandbox,
          permanentLinkPattern: context?.permanentLinkPattern
        }

        // Helper to validate LINE Group IDs
        const isValidGroupId = (id: string | null) => {
          if (!id) return false
          // LINE Group IDs start with C, Rooms with R, followed by hash
          // Mock IDs are allowed for dev
          return /^[CR][0-9a-f]{32}$/.test(id) || id.startsWith('mock-')
        }

        // Set GroupId
        let detectedId: string | null = null
        if (context?.type === 'group' || context?.type === 'room') {
          detectedId = context.groupId || context.roomId || null
        }

        if (detectedId && isValidGroupId(detectedId)) {
          this.groupId = detectedId
          console.log('[User Store] Valid Group/Room ID set:', this.groupId)
        } else if (detectedId) {
          console.warn('[User Store] Detected ID format invalid:', detectedId)
        } else {
          console.warn('[User Store] No Group/Room ID detected in context')
        }

        // NO FALLBACK to database mapping.
        // We only trust the current context.
        if (!this.groupId && this.profile?.userId) {
          const qId = route.query.groupId as string
          if (qId && isValidGroupId(qId)) {
            this.groupId = qId
            console.log('[User Store] Group ID set from valid URL Query:', this.groupId)
          }
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
