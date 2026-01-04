import { getAdminUserIds } from '~/utils/admin'

/**
 * API endpoint to initialize a group with default admins from environment variables
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { groupId } = body

  if (!groupId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing groupId',
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
    const groupRef = adminDb.collection('groups').doc(groupId)

    // Check if group already exists
    const doc = await groupRef.get()

    if (doc.exists) {
      const currentData = doc.data() || {}
      const currentAdmins = currentData.adminIds || []

      // Merge new default admins into existing list
      const newAdmins = [...new Set([...currentAdmins, ...defaultAdmins])]

      // If there are changes, update Firestore
      if (newAdmins.length > currentAdmins.length) {
        await groupRef.update({
          adminIds: newAdmins,
          updatedAt: Date.now()
        })
        console.log(`Updated group ${groupId} admins:`, newAdmins)
        return {
          success: true,
          message: 'Group admins updated',
          adminIds: newAdmins,
        }
      }

      return {
        success: true,
        message: 'Group already exists and admins are up-to-date',
        adminIds: currentAdmins,
      }
    }

    // Create group with default admins
    await groupRef.set({
      adminIds: defaultAdmins,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    return {
      success: true,
      message: 'Group initialized with default admins',
      adminIds: defaultAdmins,
    }
  } catch (error: any) {
    console.error('Failed to initialize group:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to initialize group: ' + error.message,
    })
  }
})
