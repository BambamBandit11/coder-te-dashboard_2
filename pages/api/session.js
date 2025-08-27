import crypto from 'crypto'

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

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req)
    const token = cookies.session_token
    
    if (!token) {
      return res.status(200).json({ user: null })
    }

    const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET
    if (!secret) {
      return res.status(200).json({ user: null })
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      return res.status(200).json({ user: null })
    }
    
    const [headerB64, payloadB64, sig] = parts
    const expected = crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest('base64url')
    
    if (expected !== sig) {
      return res.status(200).json({ user: null })
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return res.status(200).json({ user: null })
    }
    
    return res.status(200).json({ 
      user: { 
        email: payload.email, 
        name: payload.name, 
        picture: payload.picture 
      } 
    })
  } catch (error) {
    return res.status(200).json({ user: null })
  }
}
