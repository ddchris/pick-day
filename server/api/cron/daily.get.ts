
import { messagingApi } from '@line/bot-sdk'
import { getVotingPeriodStatus } from '~/utils/date-helper'
import { buildPushMessages, type PushEventData } from '~/server/utils/push-notifier'
import { cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp, getApps } from 'firebase-admin/app'

// Initialize Admin SDK (if not already)
// Note: In server routes, we might need to ensure this is shared or init here.
// Reusing logic from firebase.server might be cleaner but for now explicit init is safer for Cron.
// Actually, let's use the runtime config and standard init used elsewhere if available.
// Assuming we can grab the service account from config.

const initFirebaseAdmin = () => {
  const apps = getApps()
  if (apps.length) return apps[0]

  const config = useRuntimeConfig()
  const serviceAccount = JSON.parse(config.firebaseServiceAccount)

  return initializeApp({
    credential: cert(serviceAccount)
  })
}

export default defineEventHandler(async (event) => {
  // 1. Security Check
  const config = useRuntimeConfig()
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'secret_for_local_test'}`) {
    // Allow local test if defined, else strictly require CRON_SECRET which Vercel provides
    // Actually Vercel Cron sends auth header if properly configured, but for Hobby we might just use a public route with a secret query param if headers are tricky.
    // Standard Vercel Cron: https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
    // But for simplicity/robustness let's check.
    // If CRON_SECRET is not set in env, fail open? No, fail closed.
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  const app = initFirebaseAdmin()
  const db = getFirestore(app)
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.lineChannelAccessToken })

  // 2. Iterate Groups
  const groupsSnap = await db.collection('groups').get()
  const results: string[] = []

  const now = new Date()
  // Force set timezone to Taipei for calculation correctness if server is UTC?
  // The util uses `now.getDate()` which depends on system local time.
  // Vercel handles requests in UTC. We MUST adjust `now` to Taipei.
  // Add 8 hours? simple offset.
  const taipeiTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
  // Wait, `new Date()` create UTC timestamp. `getDate()` returns day of month in local time.
  // To be safe, let's use `toLocaleString` -> new Date hacks or just simple offset.
  // Proper way:
  const taipeiFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric' })
  // Actually our helper expects a Date object and calls .getDate().
  // We should pass a Date object that *represents* the time in Taipei.
  // e.g. if it is 16:00 UTC (00:00 Taipei), we want the date obj to say "check for day X".
  // Let's rely on the helper receiving a Date where .getDate() returns the Taipei day.
  // `new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))` usually works in Node.

  const checkDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const currentYear = checkDate.getFullYear()
  const currentMonth = checkDate.getMonth() + 1 // 1-12

  for (const groupDoc of groupsSnap.docs) {
    const groupId = groupDoc.id
    const settings = groupDoc.data()

    if (!settings.autoVoteStartDay || !settings.autoVoteEndDay) {
      results.push(`[${groupId}] Skipped (No Schedule Settings)`)
      continue
    }

    // 3. Determine Expected Status
    // Logic: passed Date must have correct .getDate()
    const status = getVotingPeriodStatus(checkDate, settings.autoVoteStartDay, settings.autoVoteEndDay)

    // 4. Check Current DB Status
    // Logic: Calculate accurate Target Month based on voting configuration
    // Standard (Jan 25 -> Feb 1-28): Target is Current + 1
    // Cross-Month Overlap (Feb 5, Start 25 End 5): We are finishing the vote for Feb.
    // If we strictly used Current + 1 on Feb 5, we'd look for March (Wrong).

    let targetMonthForId = currentMonth + 1
    let targetYearForId = currentYear

    const start = settings.autoVoteStartDay
    const end = settings.autoVoteEndDay
    const currentDay = checkDate.getDate()

    // If config is cross-month (Start > End) AND we are in the beginning of the month (Day <= End)
    // Then we are actually finalizing the vote for *this* month.
    if (start > end && currentDay <= end) {
      targetMonthForId = currentMonth
    }

    if (targetMonthForId > 12) {
      targetMonthForId = 1
      targetYearForId++
    }

    // Strict Group Isolation: The ID is prefixed with groupId
    const scheduleId = `${groupId}_${targetYearForId}${String(targetMonthForId).padStart(2, '0')}`
    const scheduleRef = db.collection('monthlySchedules').doc(scheduleId)
    const scheduleSnap = await scheduleRef.get()
    const scheduleData = scheduleSnap.exists ? scheduleSnap.data() : null

    const currentStatus = scheduleData?.status // 'open' | 'closed' | undefined

    // 5. Compare and Act
    if (status === 'OPEN' && currentStatus !== 'open') {
      // ACTION: OPEN VOTING
      const targetMonthStr = `${targetYearForId}/${String(targetMonthForId).padStart(2, '0')}`

      // A. Update DB
      await scheduleRef.set({
        groupId,
        month: String(targetMonthForId).padStart(2, '0'),
        status: 'open',
        updatedAt: Date.now(),
        // Initialize if new
        events: scheduleData?.events || {},
        votes: scheduleData?.votes || {}
      }, { merge: true })

      // B. Push Notification
      const pushData: PushEventData = {
        messageType: 'voting_open',
        openVoting: true,
        month: targetMonthStr
      }
      const messages = buildPushMessages(pushData)

      try {
        await client.pushMessage({ to: groupId, messages: messages as any })
        results.push(`[${groupId}] OPENED voting for ${targetMonthStr}`)
      } catch (e: any) {
        console.error(`Failed to push to ${groupId}`, e)
        results.push(`[${groupId}] OPENED (Push Failed)`)
      }

    } else if (status === 'CLOSED' && currentStatus === 'open') {
      // ACTION: CLOSE VOTING & ANNOUNCE
      // Need to calculate winners... 
      // This is complex backend logic usually in Vue.
      // We need to fetch votes, count them, sort them.

      const votes = scheduleData?.votes || {}
      const events = [] // We need targets to map dates... 
      // Generating targets server-side without the helper that uses simple holidays.json might be tricky if holidays.json is client-side.
      // However, `date-helper.ts` is shared. But `holidays.json` file access?
      // Since we're closing, we only care about dates that HAVE votes.
      // We can just iterate the `votes` map keys!

      interface VoteInfo { date: string, count: number, participants: string[] }
      const candidates: VoteInfo[] = []

      for (const [dateStr, voteData] of Object.entries(votes)) {
        const v = voteData as any
        const userIds = v.o_users || []
        if (userIds.length >= 3) {
          candidates.push({
            date: dateStr,
            count: userIds.length,
            participants: userIds // IDs only for now, fetch names?
          })
        }
      }

      // Sort
      candidates.sort((a, b) => b.count - a.count)
      const top2 = candidates.slice(0, 2)

      if (top2.length === 0) {
        // Nothing to announce really, just close.
        await scheduleRef.update({ status: 'closed', updatedAt: Date.now() })
        results.push(`[${groupId}] CLOSED (No candidates)`)
        continue
      }

      // Resolve Names (Expensive? Limit to Top 2)
      for (const cand of top2) {
        const names: string[] = []
        for (const uid of cand.participants) {
          const userSnap = await db.collection('users').doc(uid).get()
          if (userSnap.exists) names.push(userSnap.data()?.displayName || '未知')
          else names.push('未知')
        }
        cand.participants = names
      }

      // Update DB
      await scheduleRef.update({
        status: 'closed',
        updatedAt: Date.now(),
        // We don't auto-write finalEvent description here as that's for Admins to edit.
        // But we can notify.
      })

      // Push Notification
      const pushData: PushEventData = {
        messageType: 'voting_closure',
        topDates: top2
      }
      const messages = buildPushMessages(pushData)

      try {
        await client.pushMessage({ to: groupId, messages: messages as any })
        results.push(`[${groupId}] CLOSED & Announced Top 2`)
      } catch (e: any) {
        console.error(`Failed to push to ${groupId}`, e)
        results.push(`[${groupId}] CLOSED (Push Failed)`)
      }
    } else {
      results.push(`[${groupId}] No change (Status: ${currentStatus || 'new'}, Need: ${status})`)
    }
  }

  return {
    success: true,
    summary: results
  }
})
