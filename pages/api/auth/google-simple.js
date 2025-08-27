// Minimal OAuth test without encryption
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: 'OAuth not configured',
        debug: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret
        }
      })
    }

    // Simple state without encryption
    const state = Math.random().toString(36).substring(2, 15)
    
    const proto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0] || 'http'
    const host = req.headers.host
    const baseUrl = `${proto}://${host}`
    const redirectUri = `${baseUrl}/api/auth/callback-simple`
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      state: state,
      prompt: 'select_account'
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    
    return res.status(200).json({
      message: 'OAuth URL generated successfully',
      redirectUrl: url,
      debug: {
        clientId: clientId.substring(0, 10) + '...',
        redirectUri,
        state
      }
    })
    
  } catch (error) {
    console.error('OAuth error:', error)
    return res.status(500).json({ 
      error: 'OAuth failed', 
      detail: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    })
  }
}
