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
        
        // Step 2: Fetch ALL transactions with pagination
        const transactionsData = await fetchAllTransactions(baseUrl, accessToken);

        // Step 3: Return combined data
        res.status(200).json({
            expenses: [], // Skip expenses for now
            transactions: transactionsData,
            lastUpdated: new Date().toISOString(),
            environment: environment,
            totalTransactions: transactionsData.length
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

// Fetch ALL transactions with pagination
async function fetchAllTransactions(baseUrl, accessToken) {
    let allTransactions = [];
    let nextCursor = null;
    let pageCount = 0;
    
    do {
        const url = new URL(`${baseUrl}/developer/v1/transactions`);
        url.searchParams.append('limit', '100');
        
        if (nextCursor) {
            url.searchParams.append('start', nextCursor);
        }
        
        console.log(`Fetching page ${pageCount + 1}...`);
        
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
        allTransactions = allTransactions.concat(transactions);
        
        // Look for pagination cursor in the response
        nextCursor = data.page?.next;
        pageCount++;
        
        console.log(`Page ${pageCount}: Got ${transactions.length} transactions, total: ${allTransactions.length}`);
        
        // Safety limit to prevent infinite loops
        if (pageCount >= 20) {
            console.log('Reached safety limit of 20 pages');
            break;
        }
        
    } while (nextCursor);
    
    console.log(`Final total: ${allTransactions.length} transactions`);
    return allTransactions;
}
