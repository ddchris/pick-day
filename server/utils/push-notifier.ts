
interface BaseEventData {
  messageType: 'voting_open' | 'voting_closure' | 'event_announcement'
}

interface Participant {
  name: string
  avatar?: string
}

interface VotingOpenData extends BaseEventData {
  messageType: 'voting_open'
  openVoting?: boolean
  month?: string
}

interface VotingClosureData extends BaseEventData {
  messageType: 'voting_closure'
  topDates: { date: string, count: number, participants: Participant[] }[]
}

interface EventAnnouncementData extends BaseEventData {
  messageType: 'event_announcement'
  events: any[]
}

export type PushEventData = VotingOpenData | VotingClosureData | EventAnnouncementData

// Helper to render user rows
const renderParticipantRows = (participants: any[] | string) => {
  if (typeof participants === 'string') {
    const text = participants || ' ' // Prevent empty string
    return [{ type: 'text', text: text, size: 'sm', color: '#4B5563', wrap: true }]
  }
  if (Array.isArray(participants)) {
     // Filter out invalid items first
     const validParticipants = participants.filter(p => !!p)
     
     if (validParticipants.length === 0) {
        return [{ type: 'text', text: '無', size: 'sm', color: '#9CA3AF' }]
     }

     return validParticipants.map((p: any) => {
         let name = typeof p === 'string' ? p : (p.name || '')
         if (!name.trim()) name = '未知'
         
         const rawAvatar = typeof p === 'string' ? null : p.avatar
         const avatar = (rawAvatar && rawAvatar.startsWith('https://')) ? rawAvatar : null
         
         return {
             type: 'box',
             layout: 'horizontal',
             spacing: 'sm',
             margin: 'xs',
             contents: [
                 ...(avatar ? [{ 
                     type: 'image', 
                     url: avatar, 
                     size: '18px',
                     aspectRatio: '1:1',
                     aspectMode: 'cover',
                     cornerRadius: '18px',
                     gravity: 'center',
                     flex: 0
                 }] : []),
                 { type: 'text', text: name, size: 'sm', color: '#4B5563', flex: 1, wrap: true, gravity: 'center' }
             ]
         }
     })
  }
  return [{ type: 'text', text: ' ', size: 'sm' }] // Fallback for invalid type
}

export const buildPushMessages = (eventData: PushEventData) => {
  let messages: any[] = []

  // 1. Voting Open
  if (eventData.messageType === 'voting_open' || (eventData as any).openVoting) {
    const data = eventData as VotingOpenData
    const month = data.month || '本月'

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
          paddingTop: '10px',
          paddingBottom: '10px',
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
                uri: useRuntimeConfig().public.liffId
                  ? `https://liff.line.me/${useRuntimeConfig().public.liffId}`
                  : 'https://pick-day.vercel.app/'
              }
            }
          ]
        }
      }
    }]
  }

  // 2. Voting Closure (Top dates summary)
  else if (eventData.messageType === 'voting_closure') {
    const data = eventData as VotingClosureData
    const events = data.topDates || []

    // Build Ranking Rows
    const rankedRows = events.map((event: any, index: number) => {
      const count = event.count || event.countO || 0
      const isWinner = index === 0
      const dateText = event.date || '未知日期'
      
      const pRows = renderParticipantRows(event.participants)

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
                text: dateText, // Date as main title
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
            type: 'box',
            layout: 'vertical',
             // Only add margin if we have participants
            contents: pRows.length > 0 ? pRows : [{ type: 'text', text: ' ', size: 'xxs' }] 
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
          paddingTop: '10px',
          paddingBottom: '10px',
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
    const data = eventData as EventAnnouncementData
    const eventList = data.events || []

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

        // Activity Types
        if (types.length > 0) {
          detailContents.push({
            type: 'box', layout: 'baseline', spacing: 'sm',
            contents: [
              { type: 'text', text: '活動', color: '#9CA3AF', size: 'sm', flex: 1 },
              { type: 'text', text: types.join('、') || '無', weight: 'bold', color: '#4B5563', size: 'md', flex: 4, wrap: true }
            ]
          })
        }

        // Time
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
        const hasParticipants = e.participants && (Array.isArray(e.participants) ? e.participants.length > 0 : !!e.participants)
        if (hasParticipants) {
          const pRows = renderParticipantRows(e.participants)
          // Double safety: if rows are empty (shouldn't happen with updated helper), don't push the section
           if (pRows.length > 0) {
              detailContents.push({
                type: 'box', layout: 'horizontal', spacing: 'sm', margin: 'md',
                contents: [
                  { type: 'text', text: '人員', color: '#9CA3AF', size: 'sm', flex: 1 },
                  { 
                      type: 'box', 
                      layout: 'vertical', 
                      flex: 4,
                      contents: pRows
                  }
                ]
              })
           }
        }

        // Body Contents Assembly
        const bodyContents: any[] = [
          // Separator at index 0 is invalid in Flex Message Body
          { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: detailContents }
        ]

        // Optional: Payment Info
        if (hasPayment) {
          bodyContents.push({
            type: 'box', layout: 'vertical', margin: 'lg', backgroundColor: '#F3F4F6', cornerRadius: 'md', paddingAll: 'md',
            contents: [
              { type: 'text', text: '匯款資訊', size: 'xs', color: '#6B7280', weight: 'bold' },
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

        // Safety: Ensure text in bodyContents is valid
        if (bodyContents.length === 0) {
          bodyContents.push({ type: 'text', text: ' ' })
        }
        
        // Ensure date info
        const displayDate = e.date ? `${e.date} ${e.dayName || ''}`.trim() : '日期待定'

        // Tags Logic: User safer padding
        const tagContents = types.slice(0, 3).map((t: string) => ({
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#0D9488',
          cornerRadius: 'sm',
          paddingTop: 'sm', 
          paddingBottom: 'sm',
          paddingStart: 'md',
          paddingEnd: 'md',
          margin: 'xs',
          contents: [
            { type: 'text', text: t || ' ', size: 'xs', color: '#ffffff', align: 'center' }
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
              { type: 'text', text: displayDate, weight: 'bold', size: 'xl', margin: 'md', color: '#0D9488' },
              ...(tagContents.length > 0 ? [{
                type: 'box',
                layout: 'horizontal',
                contents: tagContents,
                margin: 'md'
              }] : [])
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

  return messages
}
