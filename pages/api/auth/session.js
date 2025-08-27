// Minimal session endpoint for diagnostics
export default async function handler(req, res) {
  console.log('Session endpoint called');
  
  // Return immediately to test basic functionality
  return res.status(200).json({ 
    user: null,
    timestamp: new Date().toISOString(),
    message: 'Session endpoint working - minimal version'
  });
}
