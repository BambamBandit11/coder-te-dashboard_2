export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax')
  res.status(200).json({ ok: true })
}
