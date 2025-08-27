// Optimized Ramp API for Vercel Pro (60s timeout)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('🚀 Starting Ramp API fetch...');

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

    // Step 1: Get access token with timeout
    console.log('🔑 Getting access token...');
    const accessToken = await withTimeout(getAccessToken(baseUrl, clientId, clientSecret), 15000);
    console.log(`✅ Got access token in ${Date.now() - startTime}ms`);
    
    // Step 2: Fetch data in parallel with timeouts and limits
    console.log('📊 Fetching transactions and reimbursements...');
    const [transactionsData, reimbursementsData] = await Promise.allSettled([
      withTimeout(fetchTransactions(baseUrl, accessToken, 100), 20000),
      withTimeout(fetchReimbursements(baseUrl, accessToken, 50), 20000)
    ]);
    
    const transactions = transactionsData.status === 'fulfilled' ? transactionsData.value : [];
    const expenses = reimbursementsData.status === 'fulfilled' ? reimbursementsData.value : [];
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Completed in ${totalTime}ms`);

    return res.status(200).json({
      transactions,
      expenses,
      spendCategories: [],
      spendPrograms: [],
      receipts: [],
      memos: [],
      lastUpdated: new Date().toISOString(),
      fetchTime: totalTime,
      summary: {
        transactionCount: transactions.length,
        expenseCount: expenses.length,
        totalAmount: [...transactions, ...expenses].reduce((sum, item) => sum + (item.amount || 0), 0)
      }
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ Ramp API error after ${totalTime}ms:`, error.message);
    
    return res.status(500).json({ 
      error: 'Failed to fetch Ramp data',
      message: error.message,
      fetchTime: totalTime,
      timestamp: new Date().toISOString()
    });
  }
}

// Timeout wrapper
function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Fast access token fetch
async function getAccessToken(baseUrl, clientId, clientSecret) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const response = await fetch(`${baseUrl}/developer/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: 'transactions:read reimbursements:read'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('No access token in response');
    }
    
    return data.access_token;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Optimized transactions fetch
async function fetchTransactions(baseUrl, accessToken, limit = 100) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const response = await fetch(`${baseUrl}/developer/v1/transactions?limit=${limit}&expand=merchant,user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Transactions fetch failed: ${response.status}`);
      return [];
    }

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
    clearTimeout(timeoutId);
    console.warn('Error fetching transactions:', error.message);
    return [];
  }
}

// Optimized reimbursements fetch
async function fetchReimbursements(baseUrl, accessToken, limit = 50) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
  
  try {
    const response = await fetch(`${baseUrl}/developer/v1/reimbursements?limit=${limit}&expand=user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Reimbursements fetch failed: ${response.status}`);
      return [];
    }

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
    clearTimeout(timeoutId);
    console.warn('Error fetching reimbursements:', error.message);
    return [];
  }
}
