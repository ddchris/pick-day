import { getAdminUserIds } from '~/utils/admin'

/**
 * API endpoint to initialize a group with default admins from environment variables
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { groupId } = body

  // Validation: Check if groupId is in a valid format (C/R + 32 chars OR UUID 36 chars)
  const groupIdRegex = /^([CR][0-9a-fA-F]{32}|[0-9a-fA-F-]{36})$/i
  if (!groupId || (!groupIdRegex.test(groupId) && !groupId.startsWith('mock-'))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or missing groupId format',
    })
  }

  try {
    // Get default admins from environment
    const config = useRuntimeConfig()
    const adminIds = config.public.adminUserIds || ''
    const defaultAdmins = adminIds.split(',').map(id => id.trim()).filter(Boolean)

    if (defaultAdmins.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No default admins configured in environment variables',
      })
    }

    // Initialize Firebase Admin
    const { adminDb } = await import('~/server/utils/firebase')
    // TARGET: system/latestGroup
    const groupRef = adminDb.collection('system').doc('latestGroup')

    // Check if group exists and matches the requested ID
    const doc = await groupRef.get()
    const currentData = doc.data() || {}

    // Safety: Only update if the latestGroup matches the requested ID
    if (!doc.exists || currentData.groupId !== groupId) {
      // In "Single Active Group" mode, we only support managing the latest group.
      // If the ID doesn't match, we likely shouldn't be initializing it here
      // as it would overwrite the "Active" pointer or be irrelevant.
      console.warn(`[InitGroup] Mismatch or missing: Requested ${groupId}, Current Latest: ${currentData.groupId}`)
      return {
        success: false,
        message: 'Target group is not the active latest group.',
        adminIds: []
      }
    }

    const currentAdmins = currentData.adminIds || []

    // Merge new default admins into existing list
    const newAdmins = [...new Set([...currentAdmins, ...defaultAdmins])]

    // If there are changes, update Firestore
    if (newAdmins.length > currentAdmins.length) {
      await groupRef.set({
        adminIds: newAdmins,
        updatedAt: Date.now()
      }, { merge: true })

      console.log(`Updated latestGroup (${groupId}) admins:`, newAdmins)
      return {
        success: true,
        message: 'Group admins updated',
        adminIds: newAdmins,
      }
    }

    return {
      success: true,
      message: 'Admins are up-to-date',
      adminIds: currentAdmins,
    }
  } catch (error: any) {
    console.error('Failed to initialize group:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to initialize group: ' + error.message,
    })
  }
})
