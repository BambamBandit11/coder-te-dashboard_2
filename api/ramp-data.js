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

        console.log('Starting Ramp API call with baseUrl:', baseUrl);
        
        // Step 1: Get access token
        const accessToken = await getAccessToken(baseUrl, clientId, clientSecret);
        console.log('Successfully obtained access token');
        
        // Step 2: Fetch transactions and expenses in parallel
        const [transactionsData, expensesData] = await Promise.all([
            fetchAllTransactions(baseUrl, accessToken),
            fetchAllExpenses(baseUrl, accessToken)
        ]);

        // Step 3: Return combined data
        res.status(200).json({
            transactions: transactionsData,
            expenses: expensesData,
            lastUpdated: new Date().toISOString(),
            environment: environment,
            totalTransactions: transactionsData.length,
            totalExpenses: expensesData.length
        });

    } catch (error) {
        console.error('Detailed error in handler:', error);
        res.status(500).json({ 
            error: 'Failed to fetch data from Ramp API',
            message: error.message,
            details: error.stack
        });
    }
}

// Get OAuth access token using Client Credentials flow
async function getAccessToken(baseUrl, clientId, clientSecret) {
    try {
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

// Fetch ALL transactions with pagination
async function fetchAllTransactions(baseUrl, accessToken) {
    const startDate = '2025-01-01';
    const endDate = new Date().toISOString().split('T')[0];
    
    let allTransactions = [];
    let nextCursor = null;
    let pageCount = 0;
    
    try {
        do {
            const url = new URL(`${baseUrl}/developer/v1/transactions`);
            url.searchParams.append('from_date', startDate);
            url.searchParams.append('to_date', endDate);
            url.searchParams.append('limit', '100');
            
            if (nextCursor) {
                url.searchParams.append('start', nextCursor);
            }
            
            console.log(`Fetching transactions page ${pageCount + 1}:`, url.toString());
            
            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Transactions request failed:', response.status, errorText);
                throw new Error(`Failed to fetch transactions: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const transactions = data.data || [];
            allTransactions = allTransactions.concat(transactions);
            
            // Check different possible pagination structures
            nextCursor = data.page?.next || data.next_cursor || data.pagination?.next_cursor;
            pageCount++;
            
            console.log(`Page ${pageCount}: ${transactions.length} transactions, total: ${allTransactions.length}`);
            console.log('Pagination info:', data.page || data.pagination || 'No pagination info');
            
            // Safety limit
            if (pageCount >= 50) {
                console.log('Reached safety limit of 50 pages');
                break;
            }
            
        } while (nextCursor);
        
        console.log(`Total transactions fetched: ${allTransactions.length}`);
        return allTransactions;
        
    } catch (error) {
        console.error('Error in fetchAllTransactions:', error);
        throw error;
    }
}

// Fetch ALL expenses with pagination
async function fetchAllExpenses(baseUrl, accessToken) {
    const startDate = '2025-01-01';
    const endDate = new Date().toISOString().split('T')[0];
    
    let allExpenses = [];
    let nextCursor = null;
    let pageCount = 0;
    
    try {
        do {
            const url = new URL(`${baseUrl}/developer/v1/reimbursements`);
            url.searchParams.append('from_date', startDate);
            url.searchParams.append('to_date', endDate);
            url.searchParams.append('limit', '100');
            
            if (nextCursor) {
                url.searchParams.append('start', nextCursor);
            }
            
            console.log(`Fetching expenses page ${pageCount + 1}:`, url.toString());
            
            const response = await fetch(url.toString(), {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Expenses request failed:', response.status, errorText);
                throw new Error(`Failed to fetch expenses: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const expenses = data.data || [];
            allExpenses = allExpenses.concat(expenses);
            
            // Check different possible pagination structures
            nextCursor = data.page?.next || data.next_cursor || data.pagination?.next_cursor;
            pageCount++;
            
            console.log(`Page ${pageCount}: ${expenses.length} expenses, total: ${allExpenses.length}`);
            
            // Safety limit
            if (pageCount >= 50) {
                console.log('Reached safety limit of 50 pages');
                break;
            }
            
        } while (nextCursor);
        
        console.log(`Total expenses fetched: ${allExpenses.length}`);
        return allExpenses;
        
    } catch (error) {
        console.error('Error in fetchAllExpenses:', error);
        throw error;
    }
}
