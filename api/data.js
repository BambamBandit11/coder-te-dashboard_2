// Get the original Ramp API data from the working commit
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const clientId = process.env.RAMP_CLIENT_ID;
    const clientSecret = process.env.RAMP_CLIENT_SECRET;
    const environment = process.env.RAMP_ENVIRONMENT || 'production';
    
    if (!clientId || !clientSecret) {
      return res.status(500).json({ 
        error: 'Ramp API credentials not configured',
        message: 'Please set RAMP_CLIENT_ID and RAMP_CLIENT_SECRET in Vercel environment variables'
      });
    }

    const baseUrl = environment === 'sandbox' 
      ? 'https://demo-api.ramp.com'
      : 'https://api.ramp.com';

    // Get access token
    const accessToken = await getAccessToken(baseUrl, clientId, clientSecret);
    
    // Fetch data with reasonable limits
    const [transactionsData, reimbursementsData] = await Promise.all([
      fetchTransactions(baseUrl, accessToken, 100),
      fetchReimbursements(baseUrl, accessToken, 50)
    ]);
    
    return res.status(200).json({
      transactions: transactionsData || [],
      expenses: reimbursementsData || [],
      spendCategories: [],
      spendPrograms: [],
      receipts: [],
      memos: [],
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Ramp API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch Ramp data',
      message: error.message
    });
  }
}

async function getAccessToken(baseUrl, clientId, clientSecret) {
  const response = await fetch(`${baseUrl}/developer/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'transactions:read reimbursements:read'
    })
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchTransactions(baseUrl, accessToken, limit = 100) {
  try {
    const response = await fetch(`${baseUrl}/developer/v1/transactions?limit=${limit}&expand=merchant,user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.data || []).map(transaction => ({
      id: transaction.id,
      amount: Math.abs(transaction.amount || 0) / 100,
      date: transaction.user_transaction_time || transaction.created_at,
      description: transaction.merchant?.name || 'Unknown Merchant',
      merchant: transaction.merchant?.name || 'Unknown',
      category: transaction.sk_category_name || 'Uncategorized',
      user: transaction.user?.email || 'Unknown User',
      department: transaction.user?.department?.name || 'Unknown Department',
      status: transaction.state || 'processed',
      type: 'transaction',
      receipt_url: transaction.receipts?.[0]?.download_url || null
    }));
  } catch (error) {
    return [];
  }
}

async function fetchReimbursements(baseUrl, accessToken, limit = 50) {
  try {
    const response = await fetch(`${baseUrl}/developer/v1/reimbursements?limit=${limit}&expand=user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.data || []).map(reimbursement => ({
      id: reimbursement.id,
      amount: Math.abs(reimbursement.amount || 0) / 100,
      date: reimbursement.created_at,
      description: reimbursement.memo || 'Expense Reimbursement',
      merchant: reimbursement.merchant_name || 'Expense',
      category: reimbursement.category_name || 'Expense',
      user: reimbursement.user?.email || 'Unknown User',
      department: reimbursement.user?.department?.name || 'Unknown Department',
      status: reimbursement.state || 'processed',
      type: 'expense',
      receipt_url: reimbursement.receipts?.[0]?.download_url || null
    }));
  } catch (error) {
    return [];
  }
}
