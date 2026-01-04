import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const config = useRuntimeConfig()

const apps = getApps()

if (!apps.length) {
  // Try to use service account from runtime config
  const rawConfig = config.firebaseServiceAccount

  if (rawConfig) {
    let serviceAccount: any = null

    try {
      if (typeof rawConfig === 'object') {
        serviceAccount = rawConfig
      } else if (typeof rawConfig === 'string' && rawConfig.trim().length > 2 && rawConfig !== '{}') {
        serviceAccount = JSON.parse(rawConfig)
      }

      // Validate that it has required fields
      if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key && serviceAccount.client_email) {
        // Clone the object to avoid "read only property" errors if config is frozen
        const sa = { ...serviceAccount }

        // Fix newline characters in private key
        // 1. Replace literal '\n' with real newline
        // 2. Ensure headers have newlines if missing
        let privateKey = sa.private_key.replace(/\\n/g, '\n')

        console.log('[DEBUG] Loading Service Account:')
        console.log(' - Project ID:', sa.project_id)
        console.log(' - Client Email:', sa.client_email)
        // console.log(' - Private Key Length:', privateKey.length)
        console.log(' - Private Key Start:', privateKey.substring(0, 35).replace(/\n/g, '[NL]'))

        sa.private_key = privateKey

        initializeApp({
          credential: cert(sa)
        })
        console.log('[Firebase Admin] Initialized with service account')
      } else {
        // Only warn if we actually tried to set it but it was invalid
        if (rawConfig && rawConfig !== '{}') {
          console.warn('[Firebase Admin] Service account is missing required fields, using default credentials')
        }
        if (!getApps().length) initializeApp()
      }
    } catch (e) {
      console.error('[Firebase Admin] Failed to parse service account:', e)
      // Fallback
      console.log('[Firebase Admin] Falling back to default credentials')
      if (!getApps().length) initializeApp()
    }
  } else {
    // Fallback to default credentials
    console.log('[Firebase Admin] No service account provided, using default credentials')
    if (!getApps().length) initializeApp()
  }
}

export const adminAuth = getAuth()
export const adminDb = getFirestore()
