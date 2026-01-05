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

      // Skip if likely invalid, BUT allow 'join' events which might not have userId in some contexts
      if (!groupId) {
        console.log('[Webhook] Skipping - no groupId')
        continue
      }

      if (!userId && webhookEvent.type !== 'join') {
        console.log('[Webhook] Skipping - no userId (and not join event)')
        continue
      }

      console.log('[Webhook] ✅ Capturing Group ID mapping')
      console.log('[Webhook] User ID:', userId)
      console.log('[Webhook] Group ID:', groupId)

      // 5. Store user-group mapping in Firestore
      // 5. Store user-group mapping in Firestore -> REMOVED (Single Group Strategy)
      // We no longer track individual user-group relationships here.
      // Logic is simplified to system/latestGroup on join event.

      // 6. Welcome Message & Server-Side Persistence on 'join'
      if (webhookEvent.type === 'join' && groupId) {
        try {
          const { messagingApi } = await import('@line/bot-sdk')
          const { adminDb } = await import('~/server/utils/firebase')

          const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.lineChannelAccessToken })

          // A. Fetch Group Summary (Name & Picture)
          let groupName = '未命名群組'
          let pictureUrl = ''
          try {
            const summary = await client.getGroupSummary(groupId)
            groupName = summary.groupId
            if (summary.groupName) groupName = summary.groupName
            if (summary.pictureUrl) pictureUrl = summary.pictureUrl
            console.log(`[Webhook] Fetched Group Summary: ${groupName}`)
          } catch (summaryError) {
            console.warn('[Webhook] Failed to fetch group summary (Bot might not have permission yet):', summaryError)
          }

          // B. Save to Firestore (Single Active Group Strategy)
          await adminDb.collection('system').doc('latestGroup').set({
            groupId: groupId,
            groupName: groupName,
            pictureUrl: pictureUrl,
            updatedAt: new Date().getTime()
          })
          console.log('[Webhook] ✅ Saved latestGroup to Firestore:', groupName)

          // C. Send Simple Welcome Message
          const setupLink = `https://liff.line.me/${config.public.liffId}` // No params needed now!

          await client.replyMessage({
            replyToken: (webhookEvent as any).replyToken,
            messages: [{
              type: 'text',
              text: `大家好！我是挑日子機器人 📅\n已將本群 ${groupName} 設為「管理群組」\n日後將由我為您服務揪團事項\n敬請期待！`
            }]
          })
          console.log('[Webhook] Welcome message sent to', groupId)
        } catch (e: any) {
          console.error('[Webhook] Failed to process join event:', e)
        }
      }
    }

    return { status: 'success' }
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error)
    return { status: 'error', message: error.message }
  }
})
