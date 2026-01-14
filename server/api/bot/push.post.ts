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
  const messages = buildPushMessages(eventData)

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
      // Detailed error logging
      if (error.originalError && error.originalError.response) {
        console.error('Response Data:', error.originalError.response.data)
      }
      // Critical: Log the actual failing payload
      console.log('--- FAILING PAYLOAD ---')
      console.log(JSON.stringify(messages, null, 2))
      console.log('-----------------------')

      const errorMessage = error.originalError?.response?.data?.message || error.statusMessage || 'LINE Push Failed'
      
      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: errorMessage
      })
    }
  } catch (error: any) {
    console.error('LINE Push Client Initialization Error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'LINE Push Client Initialization Failed: ' + (error.message || 'Unknown error'),
    })
  }
})
