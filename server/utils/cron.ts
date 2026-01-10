
import { messagingApi } from '@line/bot-sdk'
import { getVotingPeriodStatus } from '~/utils/date-helper'
import { buildPushMessages, type PushEventData } from '~/server/utils/push-notifier'

export async function runDailyCron() {
  const config = useRuntimeConfig()
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
    interface VoteInfo { date: string, count: number, participants: string[] }
    const candidates: VoteInfo[] = []
    
    // FETCH REAL VOTES FROM dateVotes COLLECTION
    // We cannot trust scheduleData.votes (it is empty).
    // We must iterate all days in the target month and fetch their vote docs.
    
    const daysInMonth = new Date(targetYearForId, targetMonthForId, 0).getDate()
    const checkRefs = []
    
    // Prepare IDs to fetch
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${targetYearForId}-${String(targetMonthForId).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      // ID format from stores/schedule.ts: `${groupId}_${date.replace(/-/g, '')}`
      // e.g. groupId_20260201
      const voteId = `${groupId}_${dateStr.replace(/-/g, '')}`
      checkRefs.push({ dateStr, ref: db.collection('dateVotes').doc(voteId) })
    }
    
    // Execute Parallel Fetch (1-31 reads)
    // Firestore allows parallel Await or usage of getAll if supported, but running Promise.all is compliant.
    const snapshots = await Promise.all(checkRefs.map(item => item.ref.get()))
    
    for (let i = 0; i < snapshots.length; i++) {
        const snap = snapshots[i]
        const { dateStr } = checkRefs[i]
        
        if (snap.exists) {
            const data = snap.data()
            const userIds = data?.o_users || []
            if (userIds.length >= 3) {
                candidates.push({
                  date: dateStr,
                  count: userIds.length,
                  participants: userIds
                })
            }
        }
    }

    candidates.sort((a, b) => b.count - a.count)
    const top2 = candidates.slice(0, 2)

    if (top2.length === 0) {
      await scheduleRef.update({ status: 'closed', updatedAt: Date.now() })
      results.push(`[${groupId}] CLOSED (No candidates found in ${checkRefs.length} days checked)`)
      return { success: true, summary: results }
    }

    // Resolve Names
    for (const cand of top2) {
      const members: { name: string; avatar: string }[] = []
      // cand.participants is currently string[] (userIds) from the collection fetch above
      for (const uid of (cand.participants as unknown as string[])) {
        const userSnap = await db.collection('users').doc(uid).get()
        if (userSnap.exists) {
          const uData = userSnap.data()
          members.push({
            name: uData?.displayName || '未知',
            avatar: uData?.pictureUrl || ''
          })
        } else {
          members.push({ name: '未知', avatar: '' })
        }
      }
      cand.participants = members as any
    }

    // Update DB
    await scheduleRef.update({
      status: 'closed',
      updatedAt: Date.now()
    })

    // Push Notification
    const closurePushData: PushEventData = {
      messageType: 'voting_closure',
      topDates: top2,
      realGroupId: groupId
    } as any
    const closureMessages = buildPushMessages(closurePushData)

    try {
      await client.pushMessage({ to: groupId, messages: closureMessages as any })
      results.push(`[${groupId}] CLOSED & Announced Top 2`)
    } catch (e: any) {
      console.error(`Failed to push to ${groupId}`, e)
      results.push(`[${groupId}] CLOSED (Push Failed)`)
    }
  } else {
    results.push(`[${groupId}] No change (Target: '${status}', Current: '${currentStatus}')`)
  }

  return {
    success: true,
    summary: results
  }
}
