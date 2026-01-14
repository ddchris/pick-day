import { messagingApi } from '@line/bot-sdk'
import { buildPushMessages } from '~/server/utils/push-notifier'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { groupId, eventData } = body

  if (!groupId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing groupId',
    })
  }

  const config = useRuntimeConfig()
  const token = config.lineChannelAccessToken

  // --- Message Generation Logic ---
  let messages;
  try {
    messages = buildPushMessages(eventData)
  } catch (e: any) {
    console.error('Message Build Error:', e)
    throw createError({
      statusCode: 400,
      statusMessage: `Message Build Failed: ${e.message}`
    })
  }

  // --- Sending Logic ---

  if (!token) {
    console.log('--- [LINE Bot Mock Push] ---')
    console.log('To Group:', groupId)
    console.log('Messages:', JSON.stringify(messages, null, 2))
    console.log('----------------------------')
    return {
      success: true,
      message: 'Mock push successful (No token)',
      mock: true
    }
  }

  try {
    const { MessagingApiClient } = messagingApi
    const client = new MessagingApiClient({ channelAccessToken: token })

    try {
      await client.pushMessage({
        to: groupId,
        messages: messages as any
      })
      console.log('[LINE Bot Push] ✅ Message sent successfully')
      return { success: true }
    } catch (error: any) {
      console.error('LINE Push Error:', error.statusCode, '-', error.statusMessage)
      
      let errorDetail = ''
      if (error.originalError && error.originalError.response) {
        console.error('Response Data:', error.originalError.response.data)
        const data = error.originalError.response.data
        if (data) {
             errorDetail = data.message || ''
             if (data.details && Array.isArray(data.details)) {
                 errorDetail += ' : ' + data.details.map((d: any) => `${d.property} ${d.message}`).join(', ')
             }
        }
      }
      
      // Critical: Log the actual failing payload
      console.log('--- FAILING PAYLOAD ---')
      console.log(JSON.stringify(messages, null, 2))
      console.log('-----------------------')

      const finalMessage = errorDetail || (
        typeof error === 'object' 
          ? `LINE Error: ${error.statusCode || 'Unknown'} - ${error.statusMessage || error.message || ''} ${errorDetail ? `Details: ${errorDetail}` : ''}`
          : String(error)
      )
      
      // Use 'message' field which goes into the body, as 'statusMessage' (HTTP Status Text) has length/char limits
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: 'Push Failed', // Short, valid HTTP status text
        message: finalMessage // Long detailed description
      })
    }
  } catch (error: any) {
    // If it's already a H3Error (from inner catch), rethrow
    if (error.statusCode) throw error
    
    console.error('LINE Push Client Initialization Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Client Init Failed: ' + (error.message || 'Unknown error'),
    })
  }
})
