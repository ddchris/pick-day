
import { messagingApi } from '@line/bot-sdk'
import { getVotingPeriodStatus } from '~/utils/date-helper'
import { buildPushMessages, type PushEventData } from '~/server/utils/push-notifier'
import { runDailyCron } from '~/server/utils/cron'
// Firebase initialization is handled by ~/server/utils/firebase
// import { initFirebaseAdmin } from '~/server/utils/firebase' (Using direct export)

export default defineEventHandler(async (event) => {
  // 1. Security Check
  const config = useRuntimeConfig()
  const authHeader = getRequestHeader(event, 'authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'secret_for_local_test'}`) {
    // Standard Vercel Cron protection
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
  }

  // 2. Run Logic
  return await runDailyCron()
})
