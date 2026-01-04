import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  // Initialize Firebase with runtime config
  const firebaseConfig = {
    apiKey: config.public.firebaseApiKey,
    authDomain: config.public.firebaseAuthDomain,
    projectId: config.public.firebaseProjectId,
    storageBucket: config.public.firebaseStorageBucket,
    messagingSenderId: config.public.firebaseMessagingSenderId,
    appId: config.public.firebaseAppId,
    measurementId: config.public.firebaseMeasurementId,
  }

  // Initialize Firebase
  const app: FirebaseApp = initializeApp(firebaseConfig)
  const auth: Auth = getAuth(app)
  const db: Firestore = getFirestore(app)

  // Provide Firebase instances globally
  return {
    provide: {
      firebase: {
        app,
        auth,
        db,
      },
    },
  }
})
