import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

/**
 * Composable to access Firebase app instance
 * Must be called within Nuxt context (setup, plugin, etc.)
 */
export const useFirebaseApp = (): FirebaseApp => {
  const { $firebase } = useNuxtApp()
  return $firebase.app
}

/**
 * Composable to access Firebase Auth instance
 * Must be called within Nuxt context (setup, plugin, etc.)
 */
export const useFirebaseAuth = (): Auth => {
  const { $firebase } = useNuxtApp()
  return $firebase.auth
}

/**
 * Composable to access Firebase Firestore instance
 * Must be called within Nuxt context (setup, plugin, etc.)
 */
export const useFirebaseDb = (): Firestore => {
  const { $firebase } = useNuxtApp()
  return $firebase.db
}

// Legacy exports for backward compatibility
// These will work when called from within Nuxt context
export const getFirebaseApp = () => useFirebaseApp()
export const getFirebaseAuth = () => useFirebaseAuth()
export const getFirebaseDb = () => useFirebaseDb()
