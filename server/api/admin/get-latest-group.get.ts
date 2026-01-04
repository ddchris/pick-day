
import { getFirestore } from 'firebase-admin/firestore'

export default defineEventHandler(async (event) => {
  const { adminDb } = await import('~/server/utils/firebase')

  try {
    const doc = await adminDb.collection('system').doc('latestGroup').get()

    if (!doc.exists) {
      return { success: false, message: 'No active group found. Please invite the bot to a group first.' }
    }

    const data = doc.data()
    return {
      success: true,
      group: {
        groupId: data?.groupId,
        groupName: data?.groupName,
        pictureUrl: data?.pictureUrl,
        updatedAt: data?.updatedAt
      }
    }
  } catch (error: any) {
    console.error('[API] Failed to get latest group:', error)
    return { success: false, message: error.message }
  }
})
