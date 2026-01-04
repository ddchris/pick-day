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

      if (!groupId || !userId) {
        console.log('[Webhook] Skipping - not a group event or no userId')
        continue
      }

      console.log('[Webhook] ✅ Capturing Group ID mapping')
      console.log('[Webhook] User ID:', userId)
      console.log('[Webhook] Group ID:', groupId)

      // 5. Store user-group mapping in Firestore (using admin SDK)
      try {
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

    return { status: 'success' }
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error)
    return { status: 'error', message: error.message }
  }
})
