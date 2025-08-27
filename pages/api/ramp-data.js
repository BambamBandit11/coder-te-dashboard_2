// Minimal Ramp data endpoint for diagnostics
export default async function handler(req, res) {
  console.log('Ramp data endpoint called');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientId = process.env.RAMP_CLIENT_ID;
    const clientSecret = process.env.RAMP_CLIENT_SECRET;
    const environment = process.env.RAMP_ENVIRONMENT || 'production';
    
    // Check if credentials exist
    if (!clientId || !clientSecret) {
      return res.status(200).json({ 
        error: 'Ramp API credentials not configured',
        message: 'Please set RAMP_CLIENT_ID and RAMP_CLIENT_SECRET in Vercel environment variables',
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        environment,
        timestamp: new Date().toISOString()
      });
    }

    // Return success without making API calls
    return res.status(200).json({
      message: 'Ramp endpoint working - credentials found',
      environment,
      timestamp: new Date().toISOString(),
      transactions: [],
      expenses: [],
      spendCategories: [],
      spendPrograms: [],
      receipts: [],
      memos: [],
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ramp API error:', error);
    return res.status(200).json({ 
      error: 'Endpoint error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
