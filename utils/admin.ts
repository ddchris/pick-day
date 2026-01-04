/**
 * Utility functions for admin management
 */

/**
 * Check if a user is an admin (client-side check)
 */
export const isUserAdmin = (userId: string): boolean => {
  const config = useRuntimeConfig()
  const adminIds = config.public.adminUserIds || ''
  const adminList = adminIds.split(',').map(id => id.trim()).filter(Boolean)
  return adminList.includes(userId)
}

/**
 * Get list of admin user IDs
 */
export const getAdminUserIds = (): string[] => {
  const config = useRuntimeConfig()
  const adminIds = config.public.adminUserIds || ''
  return adminIds.split(',').map(id => id.trim()).filter(Boolean)
}

/**
 * Check if a user is an admin for a specific group (from Firestore)
 */
export const checkGroupAdmin = async (groupId: string, userId: string): Promise<boolean> => {
  try {
    const { db } = useNuxtApp().$firebase
    const { doc, getDoc } = await import('firebase/firestore')

    const groupRef = doc(db, 'groups', groupId)
    const snap = await getDoc(groupRef)

    if (snap.exists()) {
      const data = snap.data()
      const adminIds = data.adminIds || []
      return adminIds.includes(userId)
    }

    return false
  } catch (error) {
    console.error('Failed to check group admin:', error)
    return false
  }
}

/**
 * Initialize group with default admins if not exists
 */
export const initializeGroupAdmins = async (groupId: string): Promise<void> => {
  try {
    const { db } = useNuxtApp().$firebase
    const { doc, getDoc, setDoc } = await import('firebase/firestore')

    const groupRef = doc(db, 'groups', groupId)
    const snap = await getDoc(groupRef)

    if (!snap.exists()) {
      // Create group document with default admins from env
      const defaultAdmins = getAdminUserIds()
      await setDoc(groupRef, {
        adminIds: defaultAdmins,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      console.log('Group initialized with admins:', defaultAdmins)
    }
  } catch (error) {
    console.error('Failed to initialize group admins:', error)
  }
}
