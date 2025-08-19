export default async function handler(req, res) {
    try {
        // Check environment variables
        const clientId = process.env.RAMP_CLIENT_ID;
        const clientSecret = process.env.RAMP_CLIENT_SECRET;
        const environment = process.env.RAMP_ENVIRONMENT;
        
        res.status(200).json({
            test: 'API endpoint is working',
            hasClientId: !!clientId,
            hasClientSecret: !!clientSecret,
            hasEnvironment: !!environment,
            environment: environment,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
}
