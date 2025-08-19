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
        
        // Step 2: Fetch expenses and transactions in parallel
        const [expensesData, transactionsData] = await Promise.all([
            fetchAllExpenses(baseUrl, accessToken),
            fetchAllTransactions(baseUrl, accessToken)
        ]);

        // Step 3: Return combined data
        res.status(200).json({
            expenses: expensesData,
            transactions: transactionsData,
            lastUpdated: new Date().toISOString(),
            environment: environment,
            totalExpenses: expensesData.length,
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

// Fetch ALL expenses from Ramp API with pagination
async function fetchAllExpenses(baseUrl, accessToken) {
    const startDate = '2025-01-01';
    const endDate = new Date().toISOString().split('T')[0];
    
    let allExpenses = [];
    let nextCursor = null;
    let pageCount = 0;
    
    do {
        const url = new URL(`${baseUrl}/developer/v1/reimbursements`);
        url.searchParams.append('from_date', startDate);
        url.searchParams.append('to_date', endDate);
        url.searchParams.append('limit', '100'); // Use reasonable page size
        
        if (nextCursor) {
            url.searchParams.append('start', nextCursor);
        }
        
        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch expenses: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const expenses = data.data || [];
        allExpenses = allExpenses.concat(expenses);
        
        nextCursor = data.page?.next;
        pageCount++;
        
        console.log(`Fetched expenses page ${pageCount}: ${expenses.length} records, total so far: ${allExpenses.length}`);
        
    } while (nextCursor && pageCount < 100); // Safety limit to prevent infinite loops
    
    console.log(`Total expenses fetched: ${allExpenses.length}`);
    return allExpenses;
}

// Fetch ALL transactions from Ramp API with pagination
async function fetchAllTransactions(baseUrl, accessToken) {
    const startDate = '2025-01-01';
    const endDate = new Date().toISOString().split('T')[0];
    
    let allTransactions = [];
    let nextCursor = null;
    let pageCount = 0;
    
    do {
        const url = new URL(`${baseUrl}/developer/v1/transactions`);
        url.searchParams.append('from_date', startDate);
        url.searchParams.append('to_date', endDate);
        url.searchParams.append('limit', '100'); // Use reasonable page size
        
        if (nextCursor) {
            url.searchParams.append('start', nextCursor);
        }
        
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
        
        nextCursor = data.page?.next;
        pageCount++;
        
        console.log(`Fetched transactions page ${pageCount}: ${transactions.length} records, total so far: ${allTransactions.length}`);
        
    } while (nextCursor && pageCount < 100); // Safety limit to prevent infinite loops
    
    console.log(`Total transactions fetched: ${allTransactions.length}`);
    return allTransactions;
}
