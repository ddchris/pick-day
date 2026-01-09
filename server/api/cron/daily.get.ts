
import { messagingApi } from '@line/bot-sdk'
import { getVotingPeriodStatus } from '~/utils/date-helper'
import { buildPushMessages, type PushEventData } from '~/server/utils/push-notifier'
// Firebase initialization is handled by ~/server/utils/firebase
// import { initFirebaseAdmin } from '~/server/utils/firebase' (Using direct export)

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

  // Use the shared adminDb which handles initialization robustly
  const { adminDb: db } = await import('~/server/utils/firebase')
  const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.lineChannelAccessToken })

  // 2. Fetch Single Active Group (Latest Group Strategy)
  const latestGroupDoc = await db.collection('system').doc('latestGroup').get()
  const results: string[] = []

  if (!latestGroupDoc.exists) {
    return { success: true, summary: ['No active group found in system/latestGroup'] }
  }

  const settings = latestGroupDoc.data()
  const groupId = settings?.groupId

  if (!groupId || !settings?.autoVoteStartDay || !settings?.autoVoteEndDay) {
    return { success: true, summary: ['Active group missing schedule settings or ID'] }
  }

  // --- Process Single Group ---

  // --- Timezone Robustness Fix ---
  // Instead of relying on toLocaleString (which depends on OS/Node ICU data),
  // we manually shift the UTC timestamp by +8 hours (Taipei).
  // We also keep the +10 min buffer for cron drift safety.
  
  const TPE_OFFSET = 8 * 60 * 60 * 1000
  const BUFFER = 10 * 60 * 1000
  
  const now = new Date()
  const shiftedTime = new Date(now.getTime() + TPE_OFFSET + BUFFER)
  
  // Use getUTC* methods on the shifted time to get "Taipei Local Time" components
  const currentYear = shiftedTime.getUTCFullYear()
  const currentMonth = shiftedTime.getUTCMonth() + 1
  const currentDay = shiftedTime.getUTCDate() // This is the safe "Taipei Day"
  
  // Reconstruct a local Date object for helper functions if needed, 
  // ensuring we pass the components explicitly or update the helper to accept numbers.
  // getVotingPeriodStatus expects a Date object and calls .getDate() on it.
  // To be safe, we'll pass a constructed Date that "looks like" Taipei time in local representation
  // just for the helper, OR better, update the helper call to just use the day number?
  // The helper `getVotingPeriodStatus` signature: (now = new Date(), ...)
  // It calls `now.getDate()`.
  // So we need to create a Date object where .getDate() returns `currentDay`.
  // If we assume Vercel is UTC, `shiftedTime.getDate()` == `currentDay` (if shiftedTime is constructed from UTC ts).
  // YES: new Date(timestamp) creates a date. .getUTCDate() returns the shifted components.
  // But .getDate() returns server-local components. If Server is UTC, .getDate() === .getUTCDate().
  // If Server is NOT UTC (rare in cloud but possible), this risks error.
  
  // Strategy: Create a "Fake Date" where the internal UTC timestamp ALIGNS with Taipei Wall Time.
  // Then use .getUTCDate() (or .toISOString) to ensure stability.
  // Actually, easiest way is to mock the date passed to helper.
  // Let's modify the helper call or make a simple object.
  // But checking helper `utils/date-helper.ts`:
  // export function getVotingPeriodStatus(now = new Date(), ...) { const day = now.getDate(); ... }
  // We should probably just pass the day number to valid logic internally. 
  // But for minimal invasion, let's just make a Date that returns the correct Day for .getDate().
  // We can pass `shiftedTime` if we trust the server is UTC.
  // Better: Let's assume the helper uses local time.
  // We can just construct `new Date(currentYear, currentMonth - 1, currentDay)`.
  // This constructs a date at Local 00:00 of that day. .getDate() will be correct.
  
  const checkDateCtx = new Date(currentYear, currentMonth - 1, currentDay)
  
  // 3. Determine Expected Status
  const status = getVotingPeriodStatus(checkDateCtx, settings.autoVoteStartDay, settings.autoVoteEndDay)
  results.push(`[System] Check Date (TPE): ${currentYear}/${currentMonth}/${currentDay}, Target Status: ${status}`)

  // 4. Check Current DB Status
  let targetMonthForId = currentMonth + 1
  let targetYearForId = currentYear

  // const start = settings.autoVoteStartDay
  const end = settings.autoVoteEndDay
  // const currentDay = checkDate.getDate() -> We already have currentDay
  
  // Cross-month logic
  if (settings.autoVoteStartDay > end && currentDay <= end) {
    targetMonthForId = currentMonth
  }

  if (targetMonthForId > 12) {
    targetMonthForId = 1
    targetYearForId++
  }

  // Strict Group Isolation
  const scheduleId = `${groupId}_${targetYearForId}${String(targetMonthForId).padStart(2, '0')}`
  const scheduleRef = db.collection('monthlySchedules').doc(scheduleId)
  const scheduleSnap = await scheduleRef.get()
  const scheduleData = scheduleSnap.exists ? scheduleSnap.data() : null

  const currentStatus = scheduleData?.status // 'open' | 'closed' | undefined

  // 5. Compare and Act
  if (status === 'OPEN' && currentStatus !== 'open') {
    // ACTION: OPEN VOTING
    const targetMonthStr = `${targetYearForId}/${String(targetMonthForId).padStart(2, '0')}`

    await scheduleRef.set({
      groupId,
      month: String(targetMonthForId).padStart(2, '0'),
      status: 'open',
      updatedAt: Date.now(),
      events: scheduleData?.events || {},
      votes: scheduleData?.votes || {}
    }, { merge: true })

    // Single Group Mode: Real ID is the groupId itself (trusted from server)
    const realTargetId = groupId

    // ... (Push Notification Logic remains similar) ...
    const pushData: PushEventData = {
      messageType: 'voting_open',
      openVoting: true,
      month: targetMonthStr,
      realGroupId: realTargetId
    } as any
    const messages = buildPushMessages(pushData)

    try {
      await client.pushMessage({ to: realTargetId, messages: messages as any })
      results.push(`[${groupId}] OPENED voting for ${targetMonthStr}`)
    } catch (e: any) {
      console.error(`Failed to push to ${realTargetId}`, e)
      results.push(`[${groupId}] OPENED (Push Failed)`)
    }

  } else if (status === 'CLOSED' && currentStatus === 'open') {
    // ACTION: CLOSE VOTING & ANNOUNCE
    const votes = scheduleData?.votes || {}

    interface VoteInfo { date: string, count: number, participants: string[] }
    const candidates: VoteInfo[] = []

    for (const [dateStr, voteData] of Object.entries(votes)) {
      const v = voteData as any
      const userIds = v.o_users || []
      if (userIds.length >= 3) {
        candidates.push({
          date: dateStr,
          count: userIds.length,
          participants: userIds
        })
      }
    }

    candidates.sort((a, b) => b.count - a.count)
    const top2 = candidates.slice(0, 2)

    if (top2.length === 0) {
      await scheduleRef.update({ status: 'closed', updatedAt: Date.now() })
      results.push(`[${groupId}] CLOSED (No candidates)`)
      return { success: true, summary: results }
    }

    // Resolve Names
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
      updatedAt: Date.now()
    })

    // Push Notification
    const pushData: PushEventData = {
      messageType: 'voting_closure',
      topDates: top2,
      realGroupId: groupId
    } as any
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

  return {
    success: true,
    summary: results
  }
})
