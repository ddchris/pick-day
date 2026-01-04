import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'

/**
 * API endpoint to manage group admins
 * GET: Get list of admins for a group
 * POST: Add or remove admin
 */
export default defineEventHandler(async (event) => {
  const method = event.method

  // Initialize Firebase Admin
  const { adminDb } = await import('~/server/utils/firebase')
  // STRICT MODE: Always target system/latestGroup
  const groupRef = adminDb.collection('system').doc('latestGroup')

  if (method === 'GET') {
    // Get list of admins
    try {
      const doc = await groupRef.get()
      if (doc.exists) {
        const data = doc.data()
        return {
          adminIds: data?.adminIds || [],
          // Return the actual Group ID this applies to, for client verification
          groupId: data?.groupId
        }
      } else {
        return {
          adminIds: [],
        }
      }
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch admins: ' + error.message,
      })
    }
  } else if (method === 'POST') {
    // Add or remove admin
    const body = await readBody(event)
    const { userId, action } = body // action: 'add' or 'remove'

    if (!userId || !action) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing userId or action',
      })
    }

    try {
      const doc = await groupRef.get()

      if (!doc.exists) {
        throw createError({
          statusCode: 404,
          statusMessage: 'No active group found. Invite bot first.',
        })
      } else {
        // Update existing group
        const data = doc.data()
        let adminIds = data?.adminIds || []

        if (action === 'add') {
          if (!adminIds.includes(userId)) {
            adminIds.push(userId)
          }
        } else if (action === 'remove') {
          adminIds = adminIds.filter((id: string) => id !== userId)
        } else {
          throw createError({
            statusCode: 400,
            statusMessage: 'Invalid action. Use "add" or "remove"',
          })
        }

        await groupRef.update({
          adminIds,
          updatedAt: Date.now(),
        })

        return {
          success: true,
          message: `Admin ${action === 'add' ? 'added' : 'removed'} successfully`,
          adminIds
        }
      }
    } catch (error: any) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update admins: ' + error.message,
      })
    }
  } else {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method not allowed',
    })
  }
})
