import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [data, setData] = useState({
    expenses: [],
    transactions: [],
    lastUpdated: null
  });
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    populateMonthFilter();
  }, []);

  const loadData = async () => {
    try {
      // Try to load cached data first
      const cachedData = localStorage.getItem('te-dashboard-data');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        setData(parsed);
        processData(parsed);
      }
      
      // Always try to fetch fresh data
      await fetchData();
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/ramp-data');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fetchedData = await response.json();
      
      const newData = {
        expenses: fetchedData.expenses || [],
        transactions: fetchedData.transactions || [],
        lastUpdated: new Date().toISOString()
      };
      
      // Cache the data
      localStorage.setItem('te-dashboard-data', JSON.stringify(newData));
      
      setData(newData);
      processData(newData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch fresh data. Showing cached data if available.');
    } finally {
      setLoading(false);
    }
  };

  const processData = (dataToProcess) => {
    // Combine expenses and transactions into a unified format
    const allTransactions = [];
    
    // Process expenses
    dataToProcess.expenses.forEach(expense => {
      allTransactions.push({
        id: expense.id,
        date: new Date(expense.created_time || expense.user_transaction_time),
        amount: expense.amount / 100, // Convert cents to dollars
        currency: expense.currency_code || 'USD',
        employee: expense.user ? `${expense.user.first_name} ${expense.user.last_name}` : 'Unknown',
        department: expense.user?.department_name || 'Unknown',
        merchant: expense.merchant?.name || expense.merchant_name || 'Unknown',
        location: expense.location?.name || 'Unknown',
        type: 'expense'
      });
    });
    
    // Process transactions
    dataToProcess.transactions.forEach(transaction => {
      allTransactions.push({
        id: transaction.id,
        date: new Date(transaction.user_transaction_time),
        amount: transaction.amount / 100, // Convert cents to dollars
        currency: transaction.currency_code || 'USD',
        employee: transaction.card_holder ? 
          `${transaction.card_holder.first_name} ${transaction.card_holder.last_name}` : 'Unknown',
        department: transaction.card_holder?.department_name || 'Unknown',
        merchant: transaction.merchant_name || 'Unknown',
        location: transaction.card_holder?.location_name || 'Unknown',
        type: 'transaction'
      });
    });
    
    // Sort by date (newest first)
    allTransactions.sort((a, b) => b.date - a.date);
    
    setFilteredData(allTransactions);
  };

  const populateMonthFilter = () => {
    const currentYear = new Date().getFullYear();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return months.map((month, index) => ({
      value: `${currentYear}-${String(index + 1).padStart(2, '0')}`,
      label: `${month} ${currentYear}`
    }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div>
      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f5f5f5;
          color: #333;
          line-height: 1.6;
        }
        .header {
          background: white;
          padding: 1rem 2rem;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .header h1 {
          color: #2563eb;
          font-size: 1.8rem;
          font-weight: 600;
        }
        .header-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .btn-primary {
          background: #2563eb;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: background-color 0.2s;
        }
        .btn-primary:hover {
          background: #1d4ed8;
        }
        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .main {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          text-align: center;
        }
        .card h3 {
          color: #6b7280;
          font-size: 0.9rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .amount {
          font-size: 2rem;
          font-weight: 700;
          color: #059669;
        }
        .count {
          font-size: 2rem;
          font-weight: 700;
          color: #2563eb;
        }
        .loading {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.9);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e5e7eb;
          border-top: 4px solid #2563eb;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 1rem;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .error {
          background: #fef2f2;
          color: #dc2626;
          padding: 1rem;
          border-radius: 6px;
          margin: 1rem 0;
          border: 1px solid #fecaca;
        }
        .hidden {
          display: none;
        }
      `}</style>

      <header className="header">
        <h1>Travel & Entertainment Dashboard</h1>
        <div className="header-controls">
          <span>Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never'}</span>
          <button 
            className="btn-primary" 
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="summary-cards">
          <div className="card">
            <h3>Total YTD Spend</h3>
            <div className="amount">
              {formatCurrency(
                filteredData
                  .filter(t => t.date.getFullYear() === new Date().getFullYear())
                  .reduce((sum, t) => sum + t.amount, 0)
              )}
            </div>
          </div>
          <div className="card">
            <h3>This Month</h3>
            <div className="amount">
              {formatCurrency(
                filteredData
                  .filter(t => 
                    t.date.getFullYear() === new Date().getFullYear() && 
                    t.date.getMonth() === new Date().getMonth()
                  )
                  .reduce((sum, t) => sum + t.amount, 0)
              )}
            </div>
          </div>
          <div className="card">
            <h3>Transaction Count</h3>
            <div className="count">{filteredData.length.toLocaleString()}</div>
          </div>
        </div>

        {error && (
          <div className="error">
            <p>{error}</p>
          </div>
        )}
      </main>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading data...</p>
        </div>
      )}
    </div>
  );
}
