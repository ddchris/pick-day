import { messagingApi } from '@line/bot-sdk'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { liffGroupId, realGroupId } = body

  if (!liffGroupId || !realGroupId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing mappings' })
  }

  // Validate format
  const uuidRegex = /^[0-9a-f-]{36}$/i
  const lineIdRegex = /^[CR][0-9a-f]{32}$/i

  if (!uuidRegex.test(liffGroupId) || !lineIdRegex.test(realGroupId)) {
    // If both are C... (legacy), it's also fine, but usually one is UUID
    if (!lineIdRegex.test(liffGroupId)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid ID formats' })
    }
  }

  // Use Admin SDK to save mapping
  // Note: We already have firebase.server utility (implied by previous sessions)
  // Let's use the local helper to get db
  const config = useRuntimeConfig()
  const { cert, initializeApp, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')

  const initAdmin = () => {
    const apps = getApps()
    if (apps.length) return apps[0]
    return initializeApp({ credential: cert(JSON.parse(config.firebaseServiceAccount)) })
  }

  const adminApp = initAdmin()
  const db = getFirestore(adminApp)

  try {
    await db.collection('groupMappers').doc(liffGroupId).set({
      liffGroupId,
      realGroupId,
      updatedAt: Date.now()
    }, { merge: true })

    console.log(`[Sync Mapping] Linked ${liffGroupId} -> ${realGroupId}`)
    return { success: true }
  } catch (e: any) {
    console.error('[Sync Mapping] Failed:', e)
    throw createError({ statusCode: 500, statusMessage: e.message })
  }
})
