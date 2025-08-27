import crypto from 'crypto'

function baseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0] || 'http'
  const host = req.headers.host
  return `${proto}://${host}`
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  header.split(';').forEach(p => {
    const [k, ...rest] = p.trim().split('=')
    if (!k) return
    out[k] = decodeURIComponent(rest.join('='))
  })
  return out
}

function setCookie(res, name, value, opts = {}) {
  const parts = []
  parts.push(`${name}=${encodeURIComponent(value)}`)
  parts.push(`Path=${opts.path || '/'}`)
  parts.push(`SameSite=${opts.sameSite || 'Lax'}`)
  if (opts.httpOnly !== false) parts.push('HttpOnly')
  if (opts.secure) parts.push('Secure')
  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`)
  res.setHeader('Set-Cookie', parts.join('; '))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return res.status(500).json({ error: 'OAuth not configured' })

  const { code, state, error: oauthError } = req.query
  
  // Handle OAuth errors from Google
  if (oauthError) {
    return res.redirect(`/auth/error?error=${encodeURIComponent(oauthError)}`)
  }
  
  const cookies = parseCookies(req)
  
  // Debug logging for production troubleshooting
  console.log('Callback debug:', {
    hasCode: !!code,
    hasState: !!state,
    receivedState: state,
    cookieState: cookies.oauth_state,
    hasVerifier: !!cookies.pkce_verifier,
    allCookies: Object.keys(cookies)
  })
  
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' })
  }
  
  if (!state) {
    return res.status(400).json({ error: 'Missing state parameter' })
  }
  
  if (!cookies.oauth_state) {
    return res.status(400).json({ error: 'Missing state cookie - cookies may not be working' })
  }
  
  if (state !== cookies.oauth_state) {
    return res.status(400).json({ 
      error: 'State mismatch', 
      debug: { received: state, expected: cookies.oauth_state }
    })
  }

  const verifier = cookies.pkce_verifier
  if (!verifier) {
    return res.status(400).json({ error: 'Missing PKCE verifier cookie' })
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${baseUrl(req)}/api/auth/callback`,
        code_verifier: verifier,
      })
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return res.status(500).json({ error: 'Token exchange failed', detail: text })
    }

    const tokens = await tokenRes.json()

    const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })

    if (!userRes.ok) {
      const text = await userRes.text()
      return res.status(500).json({ error: 'Failed to fetch userinfo', detail: text })
    }

    const profile = await userRes.json()

    const email = profile.email || ''
    if (!email.endsWith('@coder.com')) {
      // Clear cookies
      setCookie(res, 'oauth_state', '', { maxAge: 0 })
      setCookie(res, 'pkce_verifier', '', { maxAge: 0 })
      return res.redirect('/auth/error?error=AccessDenied')
    }

    // Create a signed session token (HMAC) with minimal claims
    const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex')
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 // 8 hours
    })).toString('base64url')
    const sig = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
    const sessionToken = `${header}.${payload}.${sig}`

    const secure = (req.headers['x-forwarded-proto'] || '').toString().includes('https')
    setCookie(res, 'session_token', sessionToken, { httpOnly: true, secure, path: '/', sameSite: 'Lax', maxAge: 60 * 60 * 8 })

    // Clear temporary cookies
    setCookie(res, 'oauth_state', '', { maxAge: 0 })
    setCookie(res, 'pkce_verifier', '', { maxAge: 0 })

    return res.redirect('/')
  } catch (e) {
    return res.status(500).json({ error: 'OAuth flow error', detail: e?.message || String(e) })
  }
}