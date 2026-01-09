
import { runDailyCron } from '~/server/utils/cron'

export default defineEventHandler(async (event) => {
  // Allow manual trigger from DevTools
  // Ideally we should protect this, but for this specific debugging session we allow it.
  // We can check if the user is admin if we had session management, 
  // but dev tools often bypass this with mock data.
  
  console.log('[Manual Trigger] Starting Daily Cron...')
  return await runDailyCron()
})
