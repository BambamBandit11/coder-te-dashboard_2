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
  const [filters, setFilters] = useState({
    department: 'all',
    employee: 'all',
    month: 'all',
    merchant: 'all'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [data, filters]);

  const loadData = async () => {
    try {
      const cachedData = localStorage.getItem('te-dashboard-data');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        setData(parsed);
      }
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
      
      localStorage.setItem('te-dashboard-data', JSON.stringify(newData));
      setData(newData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch fresh data');
    } finally {
      setLoading(false);
    }
  };

  const processData = (dataToProcess) => {
    const allTransactions = [];
    
    dataToProcess.expenses.forEach(expense => {
      allTransactions.push({
        id: expense.id,
        date: new Date(expense.created_time || expense.user_transaction_time),
        amount: expense.amount / 100,
        employee: expense.user ? `${expense.user.first_name} ${expense.user.last_name}` : 'Unknown',
        department: expense.user?.department_name || 'Unknown',
        merchant: expense.merchant?.name || expense.merchant_name || 'Unknown',
        location: expense.location?.name || 'Unknown',
        type: 'expense'
      });
    });
    
    dataToProcess.transactions.forEach(transaction => {
      allTransactions.push({
        id: transaction.id,
        date: new Date(transaction.user_transaction_time),
        amount: transaction.amount / 100,
        employee: transaction.card_holder ? 
          `${transaction.card_holder.first_name} ${transaction.card_holder.last_name}` : 'Unknown',
        department: transaction.card_holder?.department_name || 'Unknown',
        merchant: transaction.merchant_name || 'Unknown',
        location: transaction.card_holder?.location_name || 'Unknown',
        type: 'transaction'
      });
    });
    
    allTransactions.sort((a, b) => b.date - a.date);
    return allTransactions;
  };

  const applyFilters = () => {
    const allTransactions = processData(data);
    let filtered = [...allTransactions];
    
    if (filters.department !== 'all') {
      filtered = filtered.filter(t => t.department === filters.department);
    }
    if (filters.employee !== 'all') {
      filtered = filtered.filter(t => t.employee === filters.employee);
    }
    if (filters.month !== 'all') {
      const [year, month] = filters.month.split('-');
      filtered = filtered.filter(t => {
        const transactionYear = t.date.getFullYear();
        const transactionMonth = t.date.getMonth() + 1;
        return transactionYear === parseInt(year) && transactionMonth === parseInt(month);
      });
    }
    if (filters.merchant !== 'all') {
      filtered = filtered.filter(t => t.merchant === filters.merchant);
    }
    
    setFilteredData(filtered);
  };

  const getUniqueValues = (field) => {
    const allTransactions = processData(data);
    return [...new Set(allTransactions.map(t => t[field]))].filter(v => v && v !== 'Unknown').sort();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const ytdTotal = filteredData
    .filter(t => t.date.getFullYear() === currentYear)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const monthTotal = filteredData
    .filter(t => t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div>
      <style jsx>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; color: #333; line-height: 1.6; }
        .header { background: white; padding: 1rem 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .header h1 { color: #2563eb; font-size: 1.8rem; font-weight: 600; }
        .header-controls { display: flex; align-items: center; gap: 1rem; }
        .btn-primary { background: #2563eb; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.9rem; transition: background-color 0.2s; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-primary:disabled { background: #9ca3af; cursor: not-allowed; }
        .main { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
        .filters { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .filter-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .filter-group label { font-weight: 500; color: #374151; font-size: 0.9rem; }
        .filter-group select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.9rem; background: white; }
        .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
        .card h3 { color: #6b7280; font-size: 0.9rem; font-weight: 500; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .amount { font-size: 2rem; font-weight: 700; color: #059669; }
        .count { font-size: 2rem; font-weight: 700; color: #2563eb; }
        .transactions-table { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .transactions-table h2 { color: #374151; font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
        .table-container { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; }
        td { font-size: 0.9rem; }
        tr:hover { background: #f9fafb; }
        .amount-cell { font-weight: 600; color: #059669; }
        .loading { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.9); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1000; }
        .spinner { width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top: 4px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .error { background: #fef2f2; color: #dc2626; padding: 1rem; border-radius: 6px; margin: 1rem 0; border: 1px solid #fecaca; }
        .hidden { display: none; }
      `}</style>

      <header className="header">
        <h1>Travel & Entertainment Dashboard</h1>
        <div className="header-controls">
          <span>Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never'}</span>
          <button className="btn-primary" onClick={fetchData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>
      </header>

      <main className="main">
        <div className="filters">
          <div className="filter-group">
            <label>Department:</label>
            <select value={filters.department} onChange={(e) => setFilters({...filters, department: e.target.value})}>
              <option value="all">All Departments</option>
              {getUniqueValues('department').map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Employee:</label>
            <select value={filters.employee} onChange={(e) => setFilters({...filters, employee: e.target.value})}>
              <option value="all">All Employees</option>
              {getUniqueValues('employee').map(emp => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Month:</label>
            <select value={filters.month} onChange={(e) => setFilters({...filters, month: e.target.value})}>
              <option value="all">All Months (YTD)</option>
              {Array.from({length: 12}, (_, i) => {
                const month = String(i + 1).padStart(2, '0');
                const monthName = new Date(2025, i).toLocaleString('default', { month: 'long' });
                return <option key={month} value={`2025-${month}`}>{monthName} 2025</option>;
              })}
            </select>
          </div>
          <div className="filter-group">
            <label>Merchant:</label>
            <select value={filters.merchant} onChange={(e) => setFilters({...filters, merchant: e.target.value})}>
              <option value="all">All Merchants</option>
              {getUniqueValues('merchant').map(merchant => (
                <option key={merchant} value={merchant}>{merchant}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="summary-cards">
          <div className="card">
            <h3>Total YTD Spend</h3>
            <div className="amount">{formatCurrency(ytdTotal)}</div>
          </div>
          <div className="card">
            <h3>This Month</h3>
            <div className="amount">{formatCurrency(monthTotal)}</div>
          </div>
          <div className="card">
            <h3>Transaction Count</h3>
            <div className="count">{filteredData.length.toLocaleString()}</div>
          </div>
        </div>

        <div className="transactions-table">
          <h2>Recent Transactions</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Merchant</th>
                  <th>Amount</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, 50).map(transaction => (
                  <tr key={transaction.id}>
                    <td>{transaction.date.toLocaleDateString()}</td>
                    <td>{transaction.employee}</td>
                    <td>{transaction.department}</td>
                    <td>{transaction.merchant}</td>
                    <td className="amount-cell">{formatCurrency(transaction.amount)}</td>
                    <td>{transaction.location}</td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{textAlign: 'center', color: '#6b7280', fontStyle: 'italic'}}>
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error && <div className="error"><p>{error}</p></div>}
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
