import type { H3Event } from 'h3'
import { validateSignature, WebhookRequestBody } from '@line/bot-sdk'

export default defineEventHandler(async (event: H3Event) => {
  const config = useRuntimeConfig()
  const channelSecret = config.lineChannelSecret

  if (!channelSecret) {
    console.error('[Webhook] LINE Channel Secret not configured')
    return { status: 'error', message: 'Channel Secret missing' }
  }

  try {
    // 1. Get request body and signature
    const body = await readRawBody(event, 'utf-8')
    const signature = getHeader(event, 'x-line-signature')

    if (!body || !signature) {
      console.error('[Webhook] Missing body or signature')
      return { status: 'error', message: 'Missing required headers' }
    }

    // 2. Validate signature
    if (!validateSignature(body, channelSecret, signature)) {
      console.error('[Webhook] Invalid signature')
      return { status: 'error', message: 'Invalid signature' }
    }

    // 3. Parse webhook events
    const webhookBody: WebhookRequestBody = JSON.parse(body)
    console.log('[Webhook] Received events:', webhookBody.events.length)

    // 4. Process each event
    for (const webhookEvent of webhookBody.events) {
      console.log('[Webhook] Event type:', webhookEvent.type)
      console.log('[Webhook] Source:', webhookEvent.source)

      // Extract Group ID and User ID
      const groupId = webhookEvent.source.type === 'group' ? webhookEvent.source.groupId : null
      const userId = webhookEvent.source.userId

      // Skip if likely invalid, BUT allow 'join' events which might not have userId in some contexts (though usually do, but let's be safe for the welcome message)
      if (!groupId) {
        console.log('[Webhook] Skipping - no groupId')
        continue
      }

      if (!userId && webhookEvent.type !== 'join') {
        console.log('[Webhook] Skipping - no userId (and not join event)')
        continue
      }

      console.log('[Webhook] ✅ Processing Event')
      console.log('[Webhook] Group ID:', groupId)

      // 5. Store user-group mapping in Firestore
      if (userId) {
        try {
          const { adminDb } = await import('~/server/utils/firebase')
          await adminDb.collection('userGroupMappings').doc(userId).set({
            userId,
            groupId,
            updatedAt: new Date().getTime(),
            eventType: webhookEvent.type
          }, { merge: true })

          console.log('[Webhook] ✅ Mapping saved to Firestore')
        } catch (firestoreError: any) {
          console.error('[Webhook] Firestore save error:', firestoreError)
        }
      }

      const { messagingApi } = await import('@line/bot-sdk')
      const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.lineChannelAccessToken })



      // 7. Welcome Message / Setup Link on 'join'
      if (webhookEvent.type === 'join' && groupId) {
        try {
          const setupLink = `https://liff.line.me/${config.public.liffId}?groupId=${groupId}`

          await client.replyMessage({
            replyToken: (webhookEvent as any).replyToken,
            messages: [{
              type: 'text',
              text: `感謝邀請！我是挑日子機器人 📅\n\n本群組的真實 ID 為：\n${groupId}\n\n管理員請點擊下方連結完成初始設定：\n${setupLink}\n\n⚠️ 注意：請務必透過此連結進入，以鎖定群組 ID 並確保設定不隨 Session 遺失。`
            }]
          })
          console.log('[Webhook] Welcome message sent to', groupId)
        } catch (e: any) {
          console.error('[Webhook] Failed to send welcome message:', e)
        }
      }
    }

    return { status: 'success' }
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error)
    return { status: 'error', message: error.message }
  }
})
