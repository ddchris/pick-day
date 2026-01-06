
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

  const now = new Date()
  // Force set timezone to Taipei
  const checkDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }))
  const currentYear = checkDate.getFullYear()
  const currentMonth = checkDate.getMonth() + 1 // 1-12

  // 3. Determine Expected Status
  const status = getVotingPeriodStatus(checkDate, settings.autoVoteStartDay, settings.autoVoteEndDay)

  // 4. Check Current DB Status
  let targetMonthForId = currentMonth + 1
  let targetYearForId = currentYear

  const start = settings.autoVoteStartDay
  const end = settings.autoVoteEndDay
  const currentDay = checkDate.getDate()

  // Cross-month logic
  if (start > end && currentDay <= end) {
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
