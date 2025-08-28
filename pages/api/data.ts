import type { NextApiRequest, NextApiResponse } from 'next';

interface TransactionData {
  expenses: any[];
  transactions: any[];
  spendCategories: any[];
  spendPrograms: any[];
  receipts: any[];
  memos: any[];
  lastUpdated: string;
  environment: string;
  totalTransactions: number;
  totalReimbursements: number;
  status: string;
  warnings?: string[];
  error?: string;
  message?: string;
}

// BULLETPROOF T&E Dashboard API Endpoint
// This endpoint is designed to NEVER fail and always return usable data

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TransactionData>
) {
    // Set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            expenses: [],
            transactions: [],
            spendCategories: [],
            spendPrograms: [],
            receipts: [],
            memos: [],
            lastUpdated: new Date().toISOString(),
            environment: 'error',
            totalTransactions: 0,
            totalReimbursements: 0,
            status: 'error',
            error: 'Method not allowed',
            message: 'Only GET requests are supported'
        });
    }

    try {
        console.log('API Request received:', {
            method: req.method,
            url: req.url,
            timestamp: new Date().toISOString()
        });

        // Get environment variables with fallbacks
        const clientId = process.env.RAMP_CLIENT_ID;
        const clientSecret = process.env.RAMP_CLIENT_SECRET;
        const environment = process.env.RAMP_ENVIRONMENT || 'production';
        
        // If no credentials, return mock data for testing
        if (!clientId || !clientSecret) {
            console.warn('No Ramp API credentials found, returning mock data');
            return res.status(200).json(getMockData());
        }

        // Determine API base URL
        const baseUrl = environment === 'sandbox' 
            ? 'https://demo-api.ramp.com'
            : 'https://api.ramp.com';

        console.log('Attempting to fetch from Ramp API:', baseUrl);

        // Get access token with timeout
        const accessToken = await withTimeout(
            getAccessToken(baseUrl, clientId, clientSecret),
            10000, // 10 second timeout
            'Token request timed out'
        );
        
        if (!accessToken) {
            throw new Error('Failed to obtain access token');
        }

        console.log('Successfully obtained access token');
        
        // Fetch data with timeout and error handling
        const [transactionsData, reimbursementsData] = await Promise.allSettled([
            withTimeout(
                fetchTransactions(baseUrl, accessToken),
                15000, // 15 second timeout
                'Transactions request timed out'
            ),
            withTimeout(
                fetchReimbursements(baseUrl, accessToken),
                15000, // 15 second timeout
                'Reimbursements request timed out'
            )
        ]);

        // Process results, handling failures gracefully
        const transactions = transactionsData.status === 'fulfilled' ? transactionsData.value : [];
        const reimbursements = reimbursementsData.status === 'fulfilled' ? reimbursementsData.value : [];
        
        if (transactionsData.status === 'rejected') {
            console.warn('Transactions fetch failed:', transactionsData.reason);
        }
        if (reimbursementsData.status === 'rejected') {
            console.warn('Reimbursements fetch failed:', reimbursementsData.reason);
        }

        // Always return a valid response, even if some data failed
        const response = {
            expenses: reimbursements,
            transactions: transactions,
            spendCategories: [],
            spendPrograms: [],
            receipts: [],
            memos: [],
            lastUpdated: new Date().toISOString(),
            environment: environment,
            totalTransactions: transactions.length,
            totalReimbursements: reimbursements.length,
            status: 'success',
            warnings: [] as string[]
        };

        // Add warnings if some data failed
        if (transactionsData.status === 'rejected') {
            response.warnings.push('Some transaction data may be incomplete');
        }
        if (reimbursementsData.status === 'rejected') {
            response.warnings.push('Some reimbursement data may be incomplete');
        }

        console.log('API Response prepared:', {
            transactionCount: transactions.length,
            reimbursementCount: reimbursements.length,
            warnings: response.warnings.length
        });

        return res.status(200).json(response);

    } catch (error) {
        console.error('API Error:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        
        // NEVER return a 500 error - always return usable data
        return res.status(200).json({
            expenses: [],
            transactions: [],
            spendCategories: [],
            spendPrograms: [],
            receipts: [],
            memos: [],
            lastUpdated: new Date().toISOString(),
            environment: 'error',
            totalTransactions: 0,
            totalReimbursements: 0,
            status: 'error',
            error: 'Unable to fetch live data',
            message: 'The system is experiencing issues. Please try again later.',
            warnings: ['Using fallback data due to API issues']
        });
    }
}

// Utility function to add timeout to any promise
function withTimeout(promise, timeoutMs, timeoutMessage) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        )
    ]);
}

// Get OAuth access token with proper error handling
async function getAccessToken(baseUrl, clientId, clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(`${baseUrl}/developer/v1/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Coder-TE-Dashboard/1.0'
        },
        body: new URLSearchParams({
            'grant_type': 'client_credentials',
            'scope': 'transactions:read reimbursements:read users:read'
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} ${errorText}`);
    }

    const tokenData = await response.json();
    return tokenData.access_token;
}

// Fetch transactions with error handling
async function fetchTransactions(baseUrl, accessToken) {
    const response = await fetch(`${baseUrl}/developer/v1/transactions?limit=100`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Coder-TE-Dashboard/1.0'
        }
    });

    if (!response.ok) {
        throw new Error(`Transactions request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
}

// Fetch reimbursements with error handling
async function fetchReimbursements(baseUrl, accessToken) {
    const response = await fetch(`${baseUrl}/developer/v1/reimbursements?limit=100`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'Coder-TE-Dashboard/1.0'
        }
    });

    if (!response.ok) {
        throw new Error(`Reimbursements request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data || [];
}

// Mock data for testing when no credentials are available
function getMockData() {
    return {
        expenses: [
            {
                id: 'mock-expense-1',
                amount: 1250.00,
                merchant: 'Hotel Example',
                user_full_name: 'Test User',
                created_at: new Date().toISOString(),
                state: 'APPROVED'
            }
        ],
        transactions: [
            {
                id: 'mock-transaction-1',
                amount: 45.67,
                merchant_name: 'Coffee Shop',
                card_holder: {
                    first_name: 'Test',
                    last_name: 'User',
                    department_name: 'Engineering'
                },
                user_transaction_time: new Date().toISOString(),
                state: 'CLEARED'
            }
        ],
        spendCategories: [],
        spendPrograms: [],
        receipts: [],
        memos: [],
        lastUpdated: new Date().toISOString(),
        environment: 'mock',
        totalTransactions: 1,
        totalReimbursements: 1,
        status: 'mock',
        message: 'Using mock data for testing'
    };
}