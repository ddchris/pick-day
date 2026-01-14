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
      console.error('LINE Push Error:', error)
      
      // Attempt to inspect the error object deeply
      const errorDump: any = {
        message: error.message,
        stack: error.stack,
        keys: Object.keys(error)
      }
      
      if (error.response) errorDump.response = error.response
      if (error.body) errorDump.body = error.body // Critical: Capture the body based on screenshot evidence
      if (error.originalError) {
          errorDump.originalError = {
              message: error.originalError.message,
              response_data: error.originalError.response?.data,
              body: (error.originalError as any).body // Check here too
          }
      }
      if (error.statusCode) errorDump.statusCode = error.statusCode
      if (error.statusMessage) errorDump.statusMessage = error.statusMessage

      // Serialize carefully
      const payloadDump = JSON.parse(JSON.stringify(messages))
      
      throw createError({
        statusCode: 500, // Force 500 to ensure client sees it as error
        statusMessage: 'Push Failed',
        message: JSON.stringify({
           error: errorDump,
           payload: payloadDump
        }, null, 2)
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
