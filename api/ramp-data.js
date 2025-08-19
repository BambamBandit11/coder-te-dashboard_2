// Serverless function to fetch data from Ramp API
// This runs on Vercel's serverless infrastructure

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get Ramp API credentials from environment variables
        const clientId = process.env.RAMP_CLIENT_ID;
        const clientSecret = process.env.RAMP_CLIENT_SECRET;
        const environment = process.env.RAMP_ENVIRONMENT || 'production';
        
        if (!clientId || !clientSecret) {
            console.error('Missing Ramp API credentials');
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'Ramp API credentials not configured'
            });
        }

        // Determine API base URL based on environment
        const baseUrl = environment === 'sandbox' 
            ? 'https://demo-api.ramp.com'
            : 'https://api.ramp.com';

        console.log('Starting Ramp API call...');
        
        // Step 1: Get access token
        const accessToken = await getAccessToken(baseUrl, clientId, clientSecret);
        console.log('Got access token successfully');
        
        // Step 2: Fetch transactions with better error handling
        const transactionsResult = await fetchTransactionsWithDebug(baseUrl, accessToken);

        // Step 3: Return debug info
        res.status(200).json({
            success: true,
            debug: transactionsResult,
            lastUpdated: new Date().toISOString(),
            environment: environment
        });

    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch data from Ramp API',
            message: error.message,
            stack: error.stack
        });
    }
}

// Get OAuth access token using Client Credentials flow
async function getAccessToken(baseUrl, clientId, clientSecret) {
    try {
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        
        console.log('Requesting token from:', `${baseUrl}/developer/v1/token`);
        
        const response = await fetch(`${baseUrl}/developer/v1/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'scope': 'transactions:read reimbursements:read receipts:read users:read departments:read'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Token request failed:', response.status, errorText);
            throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
        }

        const tokenData = await response.json();
        return tokenData.access_token;
    } catch (error) {
        console.error('Error in getAccessToken:', error);
        throw error;
    }
}

// Fetch transactions with detailed debugging
async function fetchTransactionsWithDebug(baseUrl, accessToken) {
    try {
        const startDate = '2025-01-01';
        const endDate = new Date().toISOString().split('T')[0];
        
        const url = new URL(`${baseUrl}/developer/v1/transactions`);
        url.searchParams.append('from_date', startDate);
        url.searchParams.append('to_date', endDate);
        url.searchParams.append('limit', '50');
        
        console.log('Fetching transactions from:', url.toString());
        
        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Transactions request failed:', response.status, errorText);
            throw new Error(`Failed to fetch transactions: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('Response data keys:', Object.keys(data));
        console.log('Data array length:', data.data?.length);
        
        return {
            totalRecords: data.data?.length || 0,
            sampleTransaction: data.data?.[0] || null,
            paginationInfo: data.page || null,
            fullResponseStructure: {
                hasData: !!data.data,
                hasPage: !!data.page,
                topLevelKeys: Object.keys(data)
            }
        };
    } catch (error) {
        console.error('Error in fetchTransactionsWithDebug:', error);
        throw error;
    }
}
