// Scheduled function to refresh data cache daily at midnight Pacific
// This will be called by Vercel Cron Jobs

export default async function handler(req, res) {
    // Verify this is a cron job request
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Import the main data fetching function
        const { default: fetchRampData } = await import('./ramp-data.js');
        
        // Create a mock request object for the data fetching function
        const mockReq = { method: 'GET' };
        const mockRes = {
            status: (code) => ({ json: (data) => ({ statusCode: code, data }) }),
            json: (data) => ({ statusCode: 200, data })
        };
        
        // Fetch fresh data
        const result = await fetchRampData(mockReq, mockRes);
        
        console.log('Cache refresh completed:', new Date().toISOString());
        
        res.status(200).json({ 
            success: true, 
            message: 'Cache refreshed successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Cache refresh failed:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Cache refresh failed',
            message: error.message
        });
    }
}
