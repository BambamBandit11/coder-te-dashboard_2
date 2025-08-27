import crypto from 'crypto'

function baseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0] || 'http'
  const host = req.headers.host
  return `${proto}://${host}`
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
  
  // Set multiple cookies with different configurations for compatibility
  const cookieStrings = [
    parts.join('; '),
    // Fallback without HttpOnly for debugging
    parts.filter(p => p !== 'HttpOnly').join('; ')
  ]
  
  res.setHeader('Set-Cookie', cookieStrings)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Google OAuth not configured' })
  }

  const state = crypto.randomBytes(24).toString('hex')
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  // Store state and PKCE verifier short-lived in cookies
  const secure = (req.headers['x-forwarded-proto'] || '').toString().includes('https') || req.headers.host?.includes('vercel.app')
  const cookieOpts = { 
    httpOnly: true, 
    secure, 
    maxAge: 600, // 10 minutes instead of 5
    sameSite: 'Lax',
    path: '/'
  }
  
  setCookie(res, 'oauth_state', state, cookieOpts)
  setCookie(res, 'pkce_verifier', verifier, cookieOpts)

  const redirectUri = `${baseUrl(req)}/api/auth/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    include_granted_scopes: 'true',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  })

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  res.redirect(url)
}