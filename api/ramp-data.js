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
        
        // Step 2: Fetch ALL transactions with proper pagination
        const transactionsData = await fetchAllTransactions(baseUrl, accessToken);
        
        // Step 3: Fetch ALL reimbursements with proper pagination
        const reimbursementsData = await fetchAllReimbursements(baseUrl, accessToken);
        
        // Step 4: Fetch spend categories
        const spendCategoriesData = await fetchSpendCategories(baseUrl, accessToken);
        
        // Step 5: Fetch spend programs
        const spendProgramsData = await fetchSpendPrograms(baseUrl, accessToken);
        
        // Step 6: Fetch receipts
        const receiptsData = await fetchReceipts(baseUrl, accessToken);
        
        // Step 7: Fetch memos
        const memosData = await fetchMemos(baseUrl, accessToken);

        // Step 8: Return combined data
        res.status(200).json({
            expenses: reimbursementsData, // Now returning actual reimbursements data
            transactions: transactionsData,
            spendCategories: spendCategoriesData,
            spendPrograms: spendProgramsData,
            receipts: receiptsData,
            memos: memosData,
            lastUpdated: new Date().toISOString(),
            environment: environment,
            totalTransactions: transactionsData.length,
            totalReimbursements: reimbursementsData.length,
            totalSpendCategories: spendCategoriesData.length,
            totalSpendPrograms: spendProgramsData.length,
            totalReceipts: receiptsData.length,
            totalMemos: memosData.length
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
            'scope': 'accounting:read departments:read locations:read memos:read merchants:read receipt_integrations:read receipts:read reimbursements:read spend_programs:read transactions:read users:read vendors:read'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
}

// Fetch ALL transactions with proper pagination
async function fetchAllTransactions(baseUrl, accessToken) {
    let allTransactions = [];
    let nextUrl = `${baseUrl}/developer/v1/transactions?limit=100`;
    let pageCount = 0;
    
    while (nextUrl && pageCount < 20) { // Safety limit of 20 pages
        console.log(`Fetching page ${pageCount + 1}: ${nextUrl}`);
        
        const response = await fetch(nextUrl, {
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
        
        // Get the next page URL from Ramp's response
        nextUrl = data.page?.next || null;
        pageCount++;
        
        console.log(`Page ${pageCount}: Got ${transactions.length} transactions, total: ${allTransactions.length}`);
        
        if (!nextUrl) {
            console.log('No more pages available');
            break;
        }
    }
    
    if (pageCount >= 20) {
        console.log('Reached safety limit of 20 pages');
    }
    
    console.log(`Final total: ${allTransactions.length} transactions`);
    return allTransactions;
}

// Fetch ALL reimbursements with proper pagination
async function fetchAllReimbursements(baseUrl, accessToken) {
    let allReimbursements = [];
    let nextUrl = `${baseUrl}/developer/v1/reimbursements?limit=100`;
    let pageCount = 0;
    
    while (nextUrl && pageCount < 20) { // Safety limit of 20 pages
        console.log(`Fetching reimbursements page ${pageCount + 1}: ${nextUrl}`);
        
        const response = await fetch(nextUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch reimbursements: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const reimbursements = data.data || [];
        allReimbursements = allReimbursements.concat(reimbursements);
        
        // Get the next page URL from Ramp's response
        nextUrl = data.page?.next || null;
        pageCount++;
        
        console.log(`Reimbursements page ${pageCount}: Got ${reimbursements.length} reimbursements, total: ${allReimbursements.length}`);
        
        if (!nextUrl) {
            console.log('No more reimbursement pages available');
            break;
        }
    }
    
    if (pageCount >= 20) {
        console.log('Reached safety limit of 20 pages for reimbursements');
    }
    
    console.log(`Final reimbursements total: ${allReimbursements.length} reimbursements`);
    return allReimbursements;
}

// Fetch spend categories
async function fetchSpendCategories(baseUrl, accessToken) {
    try {
        console.log('Fetching spend categories');
        
        const response = await fetch(`${baseUrl}/developer/v1/spend-categories`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Failed to fetch spend categories: ${response.status} ${errorText}`);
            return []; // Return empty array if endpoint doesn't exist or fails
        }

        const data = await response.json();
        const categories = data.data || [];
        
        console.log(`Got ${categories.length} spend categories`);
        return categories;
    } catch (error) {
        console.warn('Error fetching spend categories:', error.message);
        return []; // Return empty array on error
    }
}

// Fetch spend programs
async function fetchSpendPrograms(baseUrl, accessToken) {
    try {
        console.log('Fetching spend programs');
        
        const response = await fetch(`${baseUrl}/developer/v1/spend-programs`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Failed to fetch spend programs: ${response.status} ${errorText}`);
            return []; // Return empty array if endpoint doesn't exist or fails
        }

        const data = await response.json();
        const programs = data.data || [];
        
        console.log(`Got ${programs.length} spend programs`);
        return programs;
    } catch (error) {
        console.warn('Error fetching spend programs:', error.message);
        return []; // Return empty array on error
    }
}

// Fetch receipts
async function fetchReceipts(baseUrl, accessToken) {
    try {
        console.log('Fetching receipts');
        
        const response = await fetch(`${baseUrl}/developer/v1/receipts`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Failed to fetch receipts: ${response.status} ${errorText}`);
            return []; // Return empty array if endpoint doesn't exist or fails
        }

        const data = await response.json();
        const receipts = data.data || [];
        
        console.log(`Got ${receipts.length} receipts`);
        return receipts;
    } catch (error) {
        console.warn('Error fetching receipts:', error.message);
        return []; // Return empty array on error
    }
}

// Fetch memos
async function fetchMemos(baseUrl, accessToken) {
    try {
        console.log('Fetching memos');
        
        const response = await fetch(`${baseUrl}/developer/v1/memos`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Failed to fetch memos: ${response.status} ${errorText}`);
            return []; // Return empty array if endpoint doesn't exist or fails
        }

        const data = await response.json();
        const memos = data.data || [];
        
        console.log(`Got ${memos.length} memos`);
        return memos;
    } catch (error) {
        console.warn('Error fetching memos:', error.message);
        return []; // Return empty array on error
    }
}