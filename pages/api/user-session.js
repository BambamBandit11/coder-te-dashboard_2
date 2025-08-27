export default function handler(req, res) {
  res.status(200).json({ 
    user: null,
    message: 'User session endpoint working!',
    timestamp: new Date().toISOString(),
    endpoint: 'user-session'
  })
}
