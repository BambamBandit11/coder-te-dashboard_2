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

        // Step 1: Get access token
        const accessToken = await getAccessToken(baseUrl, clientId, clientSecret);
        
        // Step 2: Fetch transactions and show pagination info
        const result = await fetchTransactionsWithPaginationInfo(baseUrl, accessToken);

        // Step 3: Return combined data with debug info
        res.status(200).json({
            expenses: [],
            transactions: result.transactions,
            lastUpdated: new Date().toISOString(),
            environment: environment,
            debug: {
                paginationInfo: result.paginationInfo,
                totalTransactions: result.transactions.length,
                hasMorePages: result.hasMorePages
            }
        });

    } catch (error) {
        console.error('Error fetching Ramp data:', error);
        res.status(500).json({ 
            error: 'Failed to fetch data from Ramp API',
            message: error.message
        });
    }
}

// Get OAuth access token using Client Credentials flow
async function getAccessToken(baseUrl, clientId, clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
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
        throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
}

// Fetch transactions and show pagination structure
async function fetchTransactionsWithPaginationInfo(baseUrl, accessToken) {
    const url = new URL(`${baseUrl}/developer/v1/transactions`);
    url.searchParams.append('limit', '20'); // Use smaller limit to ensure we get pagination
    
    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch transactions: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const transactions = data.data || [];
    
    // Extract all possible pagination info
    const paginationInfo = {
        page: data.page || null,
        pagination: data.pagination || null,
        next: data.next || null,
        next_cursor: data.next_cursor || null,
        has_more: data.has_more || null,
        total: data.total || null,
        count: data.count || null,
        fullResponseKeys: Object.keys(data)
    };
    
    const hasMorePages = !!(data.page?.next || data.next_cursor || data.has_more);
    
    console.log('Pagination info:', JSON.stringify(paginationInfo, null, 2));
    console.log('Has more pages:', hasMorePages);
    
    return {
        transactions,
        paginationInfo,
        hasMorePages
    };
}
