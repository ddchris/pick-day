export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { idToken, liffContext } = body

  // Log LIFF context if provided (for debugging)
  if (liffContext) {
    console.log('[SERVER-DEBUG] === Received LIFF Context from Client ===')
    console.log('[SERVER-DEBUG] Context:', JSON.stringify(liffContext, null, 2))
    console.log('[SERVER-DEBUG] Context Type:', liffContext.type)
    console.log('[SERVER-DEBUG] Group ID:', liffContext.groupId)
    console.log('[SERVER-DEBUG] Room ID:', liffContext.roomId)
    console.log('[SERVER-DEBUG] ============================================')
  }

  if (!idToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing ID Token',
    })
  }

  const config = useRuntimeConfig()
  const liffId = config.public.liffId

  try {
    console.log('[LOGIN-DEBUG] === Starting authentication ===')
    console.log('[LOGIN-DEBUG] LIFF ID:', liffId)
    console.log('[LOGIN-DEBUG] ID Token length:', idToken?.length)

    // 1. Verify ID Token with LINE
    // https://developers.line.biz/en/docs/line-login/verify-id-token/

    // Extract the numeric Channel ID from the LIFF ID
    const channelId = liffId.split('-')[0]

    // Using POST request (Standard)
    const params = new URLSearchParams()
    params.append('id_token', idToken)
    params.append('client_id', channelId)

    console.log('[LOGIN-DEBUG] Sending verification request to LINE API (POST)...')
    const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    console.log('[LOGIN-DEBUG] LINE API response status:', response.status)

    if (!response.ok) {
      const err = await response.json()
      console.error('[LOGIN-DEBUG] LINE API returned error:', err)
      throw new Error(err.error_description || 'LINE Token verification failed')
    }

    const data = await response.json()
    const userId = data.sub
    const name = data.name
    const picture = data.picture

    console.log('[DEBUG] Validated LINE Token. UserID:', userId, 'Name:', name)

    if (!userId || typeof userId !== 'string' || userId.length > 128) {
      console.error('[DEBUG] Invalid User ID received from LINE:', userId)
      throw createError({ statusCode: 400, statusMessage: 'Invalid User ID from LINE' })
    }

    // 2. Save/Update User Profile in Firestore
    const db = adminDb
    try {
      await db.collection('users').doc(userId).set({
        userId,
        displayName: name,
        pictureUrl: picture || '',
        updatedAt: new Date().getTime()
      }, { merge: true })
    } catch (e) {
      console.error('[DEBUG] Firestore save failed (non-critical):', e)
    }

    // 3. Create Custom Token
    const developerClaims = {
      name: name || '',
      picture: picture || ''
    }

    console.log('[DEBUG] About to create custom token')
    console.log('[DEBUG] - UserID:', userId, '(length:', userId?.length || 0, ')')
    console.log('[DEBUG] - UserID type:', typeof userId)
    console.log('[DEBUG] - Claims:', JSON.stringify(developerClaims))

    let customToken: string
    try {
      customToken = await adminAuth.createCustomToken(userId, developerClaims)
      console.log('[DEBUG] ✅ Custom token created successfully')
    } catch (tokenError: any) {
      console.error('[DEBUG] ❌ Failed to create custom token with claims')
      console.error('[DEBUG] Error code:', tokenError.code)
      console.error('[DEBUG] Error message:', tokenError.message)
      console.error('[DEBUG] Full error:', tokenError)

      console.log('[DEBUG] Retrying without claims...')
      try {
        customToken = await adminAuth.createCustomToken(userId)
        console.log('[DEBUG] ✅ Custom token created (without claims)')
      } catch (retryError: any) {
        console.error('[DEBUG] ❌ Failed to create custom token without claims')
        console.error('[DEBUG] Retry error:', retryError)
        throw retryError
      }
    }

    return {
      token: customToken,
      user: {
        userId,
        name,
        picture
      }
    }
  } catch (error: any) {
    console.error('[LOGIN] Authentication failed:', error)
    console.error('[LOGIN] Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    })
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication Failed: ' + error.message,
    })
  }
})
