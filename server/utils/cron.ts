
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

  // 4. FIND Any currently OPEN schedule for this group
  const schedulesSnap = await db.collection('monthlySchedules').where('groupId', '==', groupId).get()
  const openDocs = schedulesSnap.docs.filter((d: any) => d.data().status === 'open')

  let currentOpenRef = null
  let currentOpenId = null

  if (openDocs.length > 0) {
    currentOpenRef = openDocs[0].ref
    currentOpenId = openDocs[0].id
  }

  // Calculate the target schedule ID that SHOULD be open if we are in OPEN state
  let targetMonthForId = currentMonth + 1
  let targetYearForId = currentYear
  const end = settings.autoVoteEndDay

  // Cross-month logic
  if (settings.autoVoteStartDay > end && currentDay <= end) {
    targetMonthForId = currentMonth
  }
  if (targetMonthForId > 12) {
    targetMonthForId = 1
    targetYearForId++
  }

  const expectedScheduleId = `${groupId}_${targetYearForId}${String(targetMonthForId).padStart(2, '0')}`
  const expectedScheduleRef = db.collection('monthlySchedules').doc(expectedScheduleId)

  // 5. Compare and Act
  if (status === 'OPEN') {
    const expectedSnap = await expectedScheduleRef.get()
    const expectedData = expectedSnap.exists ? expectedSnap.data() : null

    if (expectedData?.status !== 'open') {
      // ACTION: OPEN VOTING
      const targetMonthStr = `${targetYearForId}/${String(targetMonthForId).padStart(2, '0')}`

      await expectedScheduleRef.set({
        groupId,
        month: String(targetMonthForId).padStart(2, '0'),
        status: 'open',
        updatedAt: Date.now(),
        events: expectedData?.events || {},
        votes: expectedData?.votes || {}
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
    } else {
      results.push(`[${groupId}] No change (Target: 'OPEN', Current: 'open')`)
    }
  } else if (status === 'CLOSED') {
    if (currentOpenRef && currentOpenId) {
      // ACTION: CLOSE VOTING & ANNOUNCE
      const match = currentOpenId.match(/_(\d{4})(\d{2})$/)
      if (!match) {
        results.push(`[${groupId}] CLOSED failed (Invalid schedule ID format: ${currentOpenId})`)
        return { success: true, summary: results }
      }
      const closeYear = parseInt(match[1])
      const closeMonth = parseInt(match[2])

      interface VoteInfo { date: string, count: number, participants: string[] }
      const candidates: VoteInfo[] = []

      // FETCH REAL VOTES FROM dateVotes COLLECTION
      const daysInMonth = new Date(closeYear, closeMonth, 0).getDate()
      const checkRefs = []

      // Prepare IDs to fetch
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${closeYear}-${String(closeMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const voteId = `${groupId}_${dateStr.replace(/-/g, '')}`
        checkRefs.push({ dateStr, ref: db.collection('dateVotes').doc(voteId) })
      }

      // Execute Parallel Fetch (1-31 reads)
      const snapshots = await Promise.all(checkRefs.map((item: any) => item.ref.get()))

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

      // Resolve Names
      for (const cand of top2) {
        const members: { name: string; avatar: string }[] = []
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
      await currentOpenRef.update({
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
        results.push(`[${groupId}] CLOSED & Announced ${top2.length > 0 ? 'Top 2' : 'No candidates'} for ${closeYear}/${closeMonth}`)
      } catch (e: any) {
        console.error(`Failed to push to ${groupId}`, e)
        results.push(`[${groupId}] CLOSED (Push Failed)`)
      }
    } else {
      results.push(`[${groupId}] No change (Target: 'CLOSED', Current: 'already closed or none open')`)
    }
  }

  return {
    success: true,
    summary: results
  }
}
