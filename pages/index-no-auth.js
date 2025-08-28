import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [data, setData] = useState({
    expenses: [],
    transactions: [],
    spendCategories: [],
    spendPrograms: [],
    receipts: [],
    memos: [],
    lastUpdated: null
  });
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [filters, setFilters] = useState({
    department: [],
    employee: [],
    month: 'all',
    merchant: [],
    category: [],
    memo: '',
    spendProgram: [],
    dateFrom: '',
    dateTo: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (data.expenses.length > 0 || data.transactions.length > 0) {
      applyFilters();
    }
  }, [data, filters]);

  const loadData = async () => {
    try {
      // Try to load cached data first
      if (typeof window !== 'undefined') {
        const cachedData = localStorage.getItem('te-dashboard-data');
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            setData({
              expenses: parsed.expenses || [],
              transactions: parsed.transactions || [],
              spendCategories: parsed.spendCategories || [],
              spendPrograms: parsed.spendPrograms || [],
              receipts: parsed.receipts || [],
              memos: parsed.memos || [],
              lastUpdated: parsed.lastUpdated
            });
          } catch (parseError) {
            console.warn('Failed to parse cached data:', parseError);
          }
        }
      }
      
      // Fetch fresh data
      await fetchData();
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load data');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/data');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fetchedData = await response.json();
      
      const newData = {
        expenses: fetchedData.expenses || [],
        transactions: fetchedData.transactions || [],
        spendCategories: fetchedData.spendCategories || [],
        spendPrograms: fetchedData.spendPrograms || [],
        receipts: fetchedData.receipts || [],
        memos: fetchedData.memos || [],
        lastUpdated: new Date().toISOString()
      };
      
      setData(newData);
      
      // Cache the data
      if (typeof window !== 'undefined') {
        localStorage.setItem('te-dashboard-data', JSON.stringify(newData));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to fetch data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Rest of the T&E dashboard code from the working version...
  // (I'll add this in the next step to keep it manageable)
  
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
            <span>Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never'}</span>
            <button className="btn-primary" onClick={fetchData} disabled={loading}>
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
          
          <div className="summary-cards">
            <div className="card">
              <h3>Total Transactions</h3>
              <div className="count">{(data.transactions.length + data.expenses.length).toLocaleString()}</div>
            </div>
            <div className="card">
              <h3>Total Amount</h3>
              <div className="amount">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format([...data.transactions, ...data.expenses].reduce((sum, item) => sum + (item.amount || 0), 0))}
              </div>
            </div>
          </div>

          <div className="transactions-section">
            <h2>Recent Activity</h2>
            
            {(data.transactions.length + data.expenses.length) === 0 ? (
              <div className="no-data">
                <h3>No transactions found</h3>
                <p>Click "Refresh Data" to load your Ramp transactions and expenses.</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.transactions, ...data.expenses].slice(0, 50).map((item, index) => (
                      <tr key={index}>
                        <td>{item.date ? new Date(item.date).toLocaleDateString() : 'Unknown'}</td>
                        <td>{item.description || item.merchant || 'Unknown'}</td>
                        <td className="amount-cell">
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD'
                          }).format(item.amount || 0)}
                        </td>
                        <td>
                          <span className={`type-badge type-${item.type || 'unknown'}`}>
                            {item.type === 'expense' ? 'Expense' : 'Transaction'}
                          </span>
                        </td>
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
        }
        
        .header h1 {
          color: #2563eb;
          font-size: 1.8rem;
          font-weight: 700;
          margin: 0;
        }
        
        .btn-primary {
          background: #2563eb;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
        }
        
        .main {
          padding: 2rem;
          background: #f9fafb;
          min-height: calc(100vh - 100px);
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
          margin-bottom: 0.5rem;
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
        
        .no-data {
          text-align: center;
          padding: 3rem 1rem;
          color: #6b7280;
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
        }
        
        .type-transaction {
          background-color: #dbeafe;
          color: #1e40af;
        }
        
        .type-expense {
          background-color: #dcfce7;
          color: #166534;
        }
        
        .error {
          background: #fef2f2;
          color: #dc2626;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 2rem;
        }
      `}</style>
    </>
  );
}
