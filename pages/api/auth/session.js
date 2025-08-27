export default function handler(req, res) {
  res.status(200).json({ 
    user: null,
    message: 'Session endpoint working!',
    timestamp: new Date().toISOString()
  })
}
