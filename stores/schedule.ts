import { defineStore } from 'pinia'
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc, runTransaction } from 'firebase/firestore'

// Interface for DateVote
interface VoteData {
  date: string
  o_users: string[]
  x_users: string[]
  countO: number
  countX: number
}

export const useScheduleStore = defineStore('schedule', {
  state: () => ({
    currentMonthId: null as string | null,
    status: 'closed' as 'open' | 'closed' | 'announced',
    finalEvent: null as any | null,
    events: {} as Record<string, any>, // Map of date -> event details
    votes: {} as Record<string, VoteData>,
    unsubscribeScheule: null as Function | null,
    unsubscribeVotes: [] as Function[],
  }),

  actions: {
    async subscribeToMonth(groupId: string, year: number, month: number) {
      // 1. Unsubscribe previous
      if (this.unsubscribeScheule) this.unsubscribeScheule()
      this.unsubscribeVotes.forEach(unsub => unsub())
      this.unsubscribeVotes = []
      this.votes = {}

      const monthStr = String(month).padStart(2, '0')
      const scheduleId = `${groupId}_${year}${monthStr}`
      this.currentMonthId = scheduleId

      const { db } = useNuxtApp().$firebase // Access via plugin or import

      // 2. Subscribe to Schedule Status
      const scheduleRef = doc(db, 'monthlySchedules', scheduleId)
      this.unsubscribeScheule = onSnapshot(scheduleRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          this.status = data.status
          this.finalEvent = data.finalEvent
          this.events = data.events || {}
        } else {
          // Default if not created yet (implicitly open if within date range? or waiting for admin?)
          // User requirement: "24-30 號 開放填寫" - logic creates it or status derived?
          // We'll trust Firestore data. If missing, maybe initialize? 
          // For now, default to 'closed' or handled in UI.
          this.status = 'closed'
        }
      })

      // 3. Subscribe to Votes (Deterministic IDs)
      // We need to know which dates to subscribe to.
      // Usually depends on "Target Dates". 
      // For now, we assume the UI knows the target dates and we assume expected document IDs.
      // But we can't subscribe to infinite dates.
      // Better approach: The 'monthlySchedules' doc could contain a list of 'targetDates' 
      // OR we just query the collection 'dateVotes' (but user banned collection scans).
      // "All monthly data is fetched by deterministic document IDs".
      // So we must generate the IDs and subscribe to them individually? 
      // Or maybe just fetch them once if real-time isn't critical? 
      // Pick: Real-time is nice. We will determine target dates (weekends) and subscribe.

      // We'll leave the actual subscription to dates to a separate action or doing it here if we calculate dates.
    },

    async subscribeToDates(groupId: string, dates: string[]) {
      // Clear old
      this.unsubscribeVotes.forEach(unsub => unsub())
      this.unsubscribeVotes = []

      const { db } = useNuxtApp().$firebase

      dates.forEach(date => {
        const voteId = `${groupId}_${date.replace(/-/g, '')}`
        const voteRef = doc(db, 'dateVotes', voteId)

        const unsub = onSnapshot(voteRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as VoteData
            this.votes[date] = data
          } else {
            // Initialize client-side state for missing docs
            this.votes[date] = {
              date,
              o_users: [],
              x_users: [],
              countO: 0,
              countX: 0
            }
          }
        })
        this.unsubscribeVotes.push(unsub)
      })
    },

    async toggleVote(groupId: string, date: string, type: 'O' | 'X') {
      const userStore = useUserStore()
      const userId = userStore.profile?.userId
      if (!userId) return

      const { db } = useNuxtApp().$firebase
      const voteId = `${groupId}_${date.replace(/-/g, '')}`
      const voteRef = doc(db, 'dateVotes', voteId)

      // Use transaction or arrayUnion/Remove
      // Requirement: "必須使用 Firestore transaction 或 arrayUnion / arrayRemove"
      // Simple toggle with arrayUnion/Remove is safer for concurrency than transactions for pure adds.
      // But if we need to remove from O when adding to X, we need to do both.
      // Batch or simple sequential updates. Firestore supports strictly atomic writes.

      try {
        if (type === 'O') {
          // Remove from X, Add to O
          await updateDoc(voteRef, {
            x_users: arrayRemove(userId),
            o_users: arrayUnion(userId)
            // countO/X trigger function handles counters? 
            // OR we just use array length in UI? User asked for "countO" field in DB interface?
            // If we maintain counters, we should use `increment`.
            // But array length is safer source of truth.
          }).catch(async (err) => {
            if (err.code === 'not-found') {
              await setDoc(voteRef, {
                date,
                o_users: [userId],
                x_users: [],
                countO: 1, // Optional if we rely on array
                countX: 0
              })
            } else {
              throw err
            }
          })
        } else {
          // Remove from O, Add to X
          await updateDoc(voteRef, {
            o_users: arrayRemove(userId),
            x_users: arrayUnion(userId)
          }).catch(async (err) => {
            if (err.code === 'not-found') {
              await setDoc(voteRef, {
                date,
                o_users: [],
                x_users: [userId],
                countO: 0,
                countX: 1
              })
            } else {
              throw err
            }
          })
        }
      } catch (e) {
        console.error('Vote failed', e)
      }
    }
  }
})
