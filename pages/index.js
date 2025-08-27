import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState({
    expenses: [],
    transactions: [],
    lastUpdated: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    department: '',
    employee: '',
    month: 'all',
    merchant: '',
    category: ''
  });

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.ok ? r.json() : { user: null })
      .then((data) => {
        setUser(data.user || null);
        setAuthLoading(false);
      })
      .catch(() => {
        setUser(null);
        setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // Try to load cached data first
      const cachedData = localStorage.getItem('te-dashboard-data');
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setData({
            expenses: parsed.expenses || [],
            transactions: parsed.transactions || [],
            lastUpdated: parsed.lastUpdated
          });
        } catch (parseError) {
          console.warn('Failed to parse cached data:', parseError);
        }
      }
      
      // Try to fetch fresh data
      const response = await fetch('/api/ramp-data');
      if (response.ok) {
        const fetchedData = await response.json();
        const newData = {
          expenses: Array.isArray(fetchedData.expenses) ? fetchedData.expenses : [],
          transactions: Array.isArray(fetchedData.transactions) ? fetchedData.transactions : [],
          lastUpdated: new Date().toISOString()
        };
        setData(newData);
        localStorage.setItem('te-dashboard-data', JSON.stringify(newData));
      } else {
        setError('Unable to fetch fresh data. Showing cached data if available.');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const numAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(numAmount);
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  // Redirect to sign in if not authenticated
  if (!user) {
    return (
      <div className="loading-container" style={{gap: '1rem'}}>
        <p>You must sign in to continue.</p>
        <a href="/api/auth/google" className="btn-primary" style={{textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: 6}}>Sign in with Google</a>
      </div>
    );
  }

  const totalTransactions = data.transactions.length + data.expenses.length;
  const totalAmount = [...data.transactions, ...data.expenses].reduce((sum, item) => sum + (item.amount || 0), 0);

  return (
    <>
      <Head>
        <title>Coder T&E Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div>
        <header className="header">
          <h1>Travel & Entertainment Dashboard</h1>
          <div className="header-controls">
            <div className="user-info">
              <span className="user-email">{user.email}</span>
              <button className="sign-out-btn" onClick={() => {
                document.cookie = 'session_token=; Path=/; Max-Age=0';
                window.location.href = '/auth/signin';
              }}>
                Sign Out
              </button>
            </div>
            <span>Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never'}</span>
            <button className="btn-primary" onClick={loadData} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh Data'}
            </button>
          </div>
        </header>

        <main className="main">
          {error && (
            <div className="error">
              {error}
            </div>
          )}
          
          <div className="filters">
            <div className="filter-group">
              <label>Department:</label>
              <input 
                type="text" 
                className="text-input" 
                placeholder="Filter by department..."
                value={filters.department}
                onChange={(e) => setFilters({...filters, department: e.target.value})}
              />
            </div>
            
            <div className="filter-group">
              <label>Employee:</label>
              <input 
                type="text" 
                className="text-input" 
                placeholder="Filter by employee..."
                value={filters.employee}
                onChange={(e) => setFilters({...filters, employee: e.target.value})}
              />
            </div>
            
            <div className="filter-group">
              <label>Month:</label>
              <select value={filters.month} onChange={(e) => setFilters({...filters, month: e.target.value})}>
                <option value="all">All Months</option>
                <option value="2025-01">January 2025</option>
                <option value="2025-02">February 2025</option>
                <option value="2025-03">March 2025</option>
                <option value="2025-04">April 2025</option>
                <option value="2025-05">May 2025</option>
                <option value="2025-06">June 2025</option>
                <option value="2025-07">July 2025</option>
                <option value="2025-08">August 2025</option>
                <option value="2025-09">September 2025</option>
                <option value="2025-10">October 2025</option>
                <option value="2025-11">November 2025</option>
                <option value="2025-12">December 2025</option>
              </select>
            </div>
            
            <div className="filter-group">
              <label>Merchant:</label>
              <input 
                type="text" 
                className="text-input" 
                placeholder="Filter by merchant..."
                value={filters.merchant}
                onChange={(e) => setFilters({...filters, merchant: e.target.value})}
              />
            </div>
            
            <div className="filter-group">
              <button type="button" className="clear-btn" onClick={() => setFilters({
                department: '',
                employee: '',
                month: 'all',
                merchant: '',
                category: ''
              })}>
                Clear Filters
              </button>
            </div>
          </div>

          <div className="summary-cards">
            <div className="card">
              <h3>Total Transactions</h3>
              <div className="count">{totalTransactions.toLocaleString()}</div>
            </div>
            <div className="card">
              <h3>Total Amount</h3>
              <div className="amount">{formatCurrency(totalAmount)}</div>
            </div>
            <div className="card">
              <h3>Expenses</h3>
              <div className="count">{data.expenses.length.toLocaleString()}</div>
            </div>
            <div className="card">
              <h3>Transactions</h3>
              <div className="count">{data.transactions.length.toLocaleString()}</div>
            </div>
          </div>

          <div className="transactions-section">
            <h2>Recent Activity</h2>
            
            {totalTransactions === 0 ? (
              <div className="no-data">
                <h3>No transactions found</h3>
                <p>Connect your expense management system to see transactions and expenses here.</p>
                <div className="setup-steps">
                  <h4>Next Steps:</h4>
                  <ul>
                    <li>Set up your Ramp API integration</li>
                    <li>Configure data sources and categories</li>
                    <li>Import historical transaction data</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.transactions, ...data.expenses].slice(0, 50).map((item, index) => (
                      <tr key={index}>
                        <td>{item.date ? new Date(item.date).toLocaleDateString() : 'Unknown'}</td>
                        <td>{item.description || item.merchant || 'Unknown'}</td>
                        <td className="amount-cell">{formatCurrency(item.amount)}</td>
                        <td>
                          <span className={`type-badge type-${item.type || 'unknown'}`}>
                            {item.type === 'expense' ? 'Expense' : 'Transaction'}
                          </span>
                        </td>
                        <td>{item.status || 'Processed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
      
      <style jsx>{`
        .header {
          background: white;
          padding: 1.5rem 2rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .header h1 {
          color: #2563eb;
          font-size: 1.8rem;
          font-weight: 700;
          margin: 0;
        }
        
        .header-controls {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          background: #f3f4f6;
          border-radius: 6px;
        }
        
        .user-email {
          font-size: 0.875rem;
          color: #374151;
          font-weight: 500;
        }
        
        .sign-out-btn {
          background: #6b7280;
          color: white;
          border: none;
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .sign-out-btn:hover {
          background: #4b5563;
        }
        
        .btn-primary {
          background: #2563eb;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }
        
        .btn-primary:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        
        .main {
          padding: 2rem;
          background: #f9fafb;
          min-height: calc(100vh - 100px);
        }
        
        .filters {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }
        
        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .filter-group label {
          font-weight: 500;
          color: #374151;
          font-size: 0.9rem;
        }
        
        .filter-group select, .text-input {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background-color: white;
          font-size: 0.875rem;
        }
        
        .text-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .clear-btn {
          padding: 0.5rem 1rem;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          margin-top: 1.5rem;
        }
        
        .clear-btn:hover {
          background: #b91c1c;
        }
        
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        
        .card {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
        
        .transactions-section {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .transactions-section h2 {
          color: #374151;
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 1rem;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }
        
        .no-data {
          text-align: center;
          padding: 3rem 1rem;
          color: #6b7280;
        }
        
        .no-data h3 {
          color: #374151;
          margin-bottom: 1rem;
        }
        
        .setup-steps {
          margin-top: 2rem;
          text-align: left;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        
        .setup-steps h4 {
          color: #374151;
          margin-bottom: 0.5rem;
        }
        
        .setup-steps ul {
          padding-left: 1.5rem;
        }
        
        .setup-steps li {
          margin: 0.5rem 0;
        }
        
        .table-container {
          overflow-x: auto;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          text-align: left;
          padding: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        td {
          font-size: 0.9rem;
        }
        
        tr:hover {
          background: #f9fafb;
        }
        
        .amount-cell {
          font-weight: 600;
          color: #059669;
        }
        
        .type-badge {
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: capitalize;
        }
        
        .type-transaction {
          background-color: #dbeafe;
          color: #1e40af;
        }
        
        .type-expense {
          background-color: #dcfce7;
          color: #166534;
        }
        
        .type-unknown {
          background-color: #f3f4f6;
          color: #6b7280;
        }
        
        .loading-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f9fafb;
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
          margin: 0 0 2rem 0;
          border: 1px solid #fecaca;
        }
        
        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .filters {
            grid-template-columns: 1fr;
          }
          
          .summary-cards {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .main {
            padding: 1rem;
          }
        }
      `}</style>
    </>
  );
}
