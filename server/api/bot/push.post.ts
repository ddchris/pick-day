import { messagingApi } from '@line/bot-sdk'

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

  let messages: any[] = []

  // --- Message Generation Logic ---

  // 1. Voting Open
  if (eventData.messageType === 'voting_open' || eventData.openVoting) {
    const month = eventData.month || '本月'

    messages = [{
      type: 'flex',
      altText: `📢 ${month} 挑日子開始！`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#0D9488', // Teal
          contents: [
            { type: 'text', text: `📅 ${month} 挑日子開始！`, weight: 'bold', color: '#FFFFFF', size: 'lg' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: '請大家點擊下方按鈕投票，選擇方便的日期！', wrap: true, color: '#374151', size: 'md' },
            { type: 'text', text: '💡 請使用 LINE 內建瀏覽器開啟', size: 'xs', color: '#E34234', wrap: true, weight: 'bold' }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#0D9488',
              action: {
                type: 'uri',
                label: '前往投票',
                uri: 'https://pick-52c90.web.app/'
              }
            }
          ]
        }
      }
    }]
  }

  // 2. Voting Closure (Top dates summary)
  else if (eventData.messageType === 'voting_closure') {
    const events = eventData.topDates || []

    // Build Ranking Rows
    const rankedRows = events.map((event: any, index: number) => {
      const count = event.count || event.countO || 0
      const isWinner = index === 0
      const participantsStr = Array.isArray(event.participants) ? event.participants.join('、') : (event.participants || '')

      return {
        type: 'box',
        layout: 'vertical', // Vertical container for each result
        margin: 'md',
        spacing: 'sm',
        contents: [
          // Row 1: Date and Count
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: event.date, // Date as main title
                weight: 'bold',
                size: isWinner ? 'xl' : 'lg',
                color: isWinner ? '#D97706' : '#1F2937',
                flex: 4,
                wrap: true
              },
              {
                type: 'text',
                text: `${count}人`,
                size: 'md',
                color: '#4B5563',
                align: 'end',
                gravity: 'center'
              }
            ]
          },
          // Row 2: Participants
          {
            type: 'text',
            text: participantsStr,
            size: 'sm',
            color: '#6B7280',
            wrap: true,
            margin: 'xs'
          }
        ]
      }
    })

    messages = [{
      type: 'flex',
      altText: '🏆 投票截止！活動日期出爐',
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#F59E0B', // Amber/Gold
          contents: [
            { type: 'text', text: '🏆 投票截止！', weight: 'bold', color: '#FFFFFF', size: 'lg' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            { type: 'text', text: '活動候選日期出爐', weight: 'bold', size: 'md', color: '#374151' },
            { type: 'separator', color: '#E5E7EB', margin: 'md' },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              spacing: 'md', // Increased spacing between entries
              contents: rankedRows.length > 0 ? rankedRows : [{ type: 'text', text: '無有效投票', color: '#9CA3AF' }]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '請等待管理員公佈詳細活動資訊。', size: 'xs', color: '#E34234', align: 'center', weight: 'bold' }
          ]
        }
      }
    }]
  }

  // 3. Event Announcement (Final Details)
  else if (eventData.messageType === 'event_announcement') {
    const eventList = eventData.events || []

    if (eventList.length === 0) {
      messages = [{ type: 'text', text: '本月無活動。' }]
    } else {
      // Construct Flex Message Carousel
      const bubbles = eventList.map((e: any) => {
        // Safe helpers
        const types = Array.isArray(e.types) ? e.types : []
        const hasPayment = e.paymentInfo && e.cost !== '0' && e.cost !== ''
        const hasRemarks = !!e.remarks

        // Detail Rows
        const detailContents: any[] = []

        // Time
        // Activity Types
        if (types.length > 0) {
          detailContents.push({
            type: 'box', layout: 'baseline', spacing: 'sm',
            contents: [
              { type: 'text', text: '活動', color: '#9CA3AF', size: 'sm', flex: 1 },
              { type: 'text', text: types.join('、'), weight: 'bold', color: '#4B5563', size: 'md', flex: 4, wrap: true }
            ]
          })
        }

        detailContents.push({
          type: 'box', layout: 'baseline', spacing: 'sm',
          contents: [
            { type: 'text', text: '時間', color: '#9CA3AF', size: 'sm', flex: 1 },
            { type: 'text', text: e.time || '待定', weight: 'bold', color: '#4B5563', size: 'md', flex: 4, wrap: true }
          ]
        })

        // Location
        detailContents.push({
          type: 'box', layout: 'baseline', spacing: 'sm',
          contents: [
            { type: 'text', text: '地點', color: '#9CA3AF', size: 'sm', flex: 1 },
            { type: 'text', text: e.location || '待定', weight: 'bold', color: '#4B5563', size: 'md', flex: 4, wrap: true }
          ]
        })

        // Cost
        detailContents.push({
          type: 'box', layout: 'baseline', spacing: 'sm',
          contents: [
            { type: 'text', text: '費用', color: '#9CA3AF', size: 'sm', flex: 1 },
            { type: 'text', text: e.cost || '免費', weight: 'bold', color: '#4B5563', size: 'md', flex: 4, wrap: true }
          ]
        })

        // Participants
        if (e.participants) {
          detailContents.push({
            type: 'box', layout: 'baseline', spacing: 'sm', margin: 'md',
            contents: [
              { type: 'text', text: '人員', color: '#9CA3AF', size: 'sm', flex: 1 },
              { type: 'text', text: e.participants, weight: 'bold', color: '#4B5563', size: 'md', flex: 4, wrap: true }
            ]
          })
        }

        // Body Contents Assembly
        const bodyContents: any[] = [
          { type: 'separator', color: '#E5E7EB' },
          { type: 'box', layout: 'vertical', margin: 'lg', spacing: 'sm', contents: detailContents }
        ]

        // Optional: Payment Info
        if (hasPayment) {
          bodyContents.push({
            type: 'box', layout: 'vertical', margin: 'lg', backgroundColor: '#F3F4F6', cornerRadius: 'md', paddingAll: 'md',
            contents: [
              { type: 'text', text: '匯款資訊', size: 'xs', color: '#6B7280', weight: 'bold' },
              // removed invalid clipboard action
              { type: 'text', text: e.paymentInfo, size: 'md', color: '#374151', wrap: true, margin: 'xs' }
            ]
          })
        }

        // Optional: Remarks
        if (hasRemarks) {
          bodyContents.push({
            type: 'box', layout: 'vertical', margin: 'lg',
            contents: [
              { type: 'text', text: '備註', size: 'xs', color: '#9CA3AF' },
              { type: 'text', text: e.remarks, size: 'md', color: '#4B5563', wrap: true, margin: 'xs' }
            ]
          })
        }

        // Safety: Ensure bodyContents is valid
        if (bodyContents.length === 0) {
          bodyContents.push({ type: 'text', text: ' ' })
        }

        // Tags Logic: Fix invalid Text properties
        // Wrap valid Text in Box for badge style or plain text
        // For simplicity and validity, we use a horizontal layout of Boxes
        const tagContents = types.slice(0, 3).map((t: string) => ({
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#0D9488',
          cornerRadius: 'sm',
          paddingAll: 'xs',
          margin: 'xs',
          contents: [
            { type: 'text', text: t, size: 'xs', color: '#ffffff', align: 'center' }
          ]
        }))

        return {
          type: 'bubble',
          size: 'mega',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '📅 本月活動定案', weight: 'bold', color: '#1F2937', size: 'xs' },
              { type: 'text', text: `${e.date} ${e.dayName}`, weight: 'bold', size: 'xl', margin: 'md', color: '#0D9488' },
              {
                type: 'box',
                layout: 'horizontal',
                contents: tagContents.length > 0 ? tagContents : [{ type: 'spacer' }],
                margin: 'md'
                // removed invalid wrap: true
              }
            ],
            paddingBottom: 'none'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: bodyContents
          }
        }
      })

      messages = [{
        type: 'flex',
        altText: '本月活動資訊公佈！',
        contents: {
          type: 'carousel',
          contents: bubbles
        }
      }]
    }
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
      // Detailed error logging
      if (error.originalError && error.originalError.response) {
        console.error('Response Data:', error.originalError.response.data)
      }
      // Critical: Log the actual failing payload
      console.log('--- FAILING PAYLOAD ---')
      console.log(JSON.stringify(messages, null, 2))
      console.log('-----------------------')

      throw createError({
        statusCode: error.statusCode || 500,
        statusMessage: 'LINE Push Failed'
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
