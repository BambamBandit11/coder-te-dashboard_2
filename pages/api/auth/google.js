import crypto from 'crypto'

function baseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0] || 'http'
  const host = req.headers.host
  return `${proto}://${host}`
}

// Simple Base64 encoding instead of encryption (Vercel compatible)
function encodeState(data) {
  try {
    const text = JSON.stringify(data)
    return Buffer.from(text, 'utf8').toString('base64url')
  } catch (e) {
    console.error('Encoding error:', e)
    throw new Error('Failed to encode state')
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      console.error('Missing OAuth config:', { hasClientId: !!clientId, hasClientSecret: !!clientSecret })
      return res.status(500).json({ error: 'Google OAuth not configured' })
    }

    const verifier = crypto.randomBytes(32).toString('base64url')
    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

    // Encode state and verifier into the state parameter (Base64 instead of encryption)
    const stateData = {
      verifier,
      timestamp: Date.now()
    }
    
    let encodedState
    try {
      encodedState = encodeState(stateData)
    } catch (e) {
      console.error('State encoding failed:', e)
      return res.status(500).json({ error: 'Failed to create OAuth state' })
    }

    const redirectUri = `${baseUrl(req)}/api/auth/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      include_granted_scopes: 'true',
      state: encodedState,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    res.redirect(url)
  } catch (e) {
    console.error('OAuth start error:', e)
    return res.status(500).json({ error: 'OAuth initialization failed', detail: e.message })
  }
}