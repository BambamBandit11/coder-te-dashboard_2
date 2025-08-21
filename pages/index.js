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
    department: 'all',
    employee: 'all',
    month: 'all',
    merchant: 'all',
    category: 'all',
    memo: '',
    spendCategory: 'all',
    spendProgram: 'all',
    dateFrom: '',
    dateTo: ''
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
        spendCategories: fetchedData.spendCategories || [],
        spendPrograms: fetchedData.spendPrograms || [],
        receipts: fetchedData.receipts || [],
        memos: fetchedData.memos || [],
        lastUpdated: new Date().toISOString()
      };
      
      setData(newData);
      localStorage.setItem('te-dashboard-data', JSON.stringify(newData));
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch fresh data. Showing cached data if available.');
    } finally {
      setLoading(false);
    }
  };

  const getSpendProgramName = (spendProgramId) => {
    if (!spendProgramId || !data.spendPrograms) return null;
    const program = data.spendPrograms.find(p => p.id === spendProgramId);
    return program ? (program.name || program.display_name) : null;
  };

  const processData = () => {
    const allTransactions = [];
    
    // Process expenses (reimbursements)
    data.expenses.forEach(expense => {
      const glAccount = expense.accounting_field_selections?.find(cat => 
        cat.type === 'GL_ACCOUNT'
      ) || expense.line_items?.[0]?.accounting_field_selections?.find(cat => 
        cat.type === 'GL_ACCOUNT'
      );
      
      const location = expense.start_location || expense.end_location || 'Unknown';
      
      allTransactions.push({
        id: expense.id,
        date: new Date(expense.transaction_date || expense.created_at),
        amount: expense.amount,
        currency: expense.currency || 'USD',
        employee: expense.user_full_name || 'Unknown',
        department: expense.line_items?.[0]?.accounting_field_selections?.find(cat => 
          cat.type === 'OTHER' && cat.category_info?.name === 'Department'
        )?.name || 'Unknown',
        merchant: expense.merchant || 'Unknown',
        location: location,
        type: 'expense',
        accountingCategory: glAccount?.name || 'Uncategorized',
        merchantDescriptor: expense.merchant || 'Unknown',
        state: expense.state || 'Unknown',
        cardHolderLocation: 'N/A',
        memo: expense.memo || 'No memo',
        spendCategory: 'Reimbursement',
        spendProgram: getSpendProgramName(expense.spend_program_id) || 'No Program'
      });
    });
    
    // Process transactions
    data.transactions.forEach(transaction => {
      const glAccount = transaction.accounting_categories?.find(cat => 
        cat.tracking_category_remote_type === 'GL_ACCOUNT'
      );
      
      const merchantLocation = transaction.merchant_location;
      const locationString = [merchantLocation?.city, merchantLocation?.state, merchantLocation?.country]
        .filter(Boolean).join(', ') || 'Unknown';
      
      allTransactions.push({
        id: transaction.id,
        date: new Date(transaction.user_transaction_time),
        amount: transaction.amount / 100,
        currency: transaction.currency_code || 'USD',
        employee: transaction.card_holder ? 
          `${transaction.card_holder.first_name} ${transaction.card_holder.last_name}` : 'Unknown',
        department: transaction.card_holder?.department_name || 'Unknown',
        merchant: transaction.merchant_name || 'Unknown',
        location: locationString,
        type: 'transaction',
        accountingCategory: glAccount?.category_name || 'Uncategorized',
        merchantDescriptor: transaction.merchant_descriptor || transaction.merchant_name || 'Unknown',
        state: transaction.state || 'Unknown',
        cardHolderLocation: transaction.card_holder?.location_name || 'Unknown',
        memo: transaction.memo || 'No memo',
        spendCategory: transaction.sk_category_name || 'Uncategorized',
        spendProgram: getSpendProgramName(transaction.spend_program_id) || 'No Program'
      });
    });
    
    allTransactions.sort((a, b) => b.date - a.date);
    return allTransactions;
  };

  const applyFilters = () => {
    const processed = processData();
    let filtered = [...processed];
    
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
    } else {
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        filtered = filtered.filter(t => t.date >= fromDate);
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(t => t.date <= toDate);
      }
    }
    
    if (filters.merchant !== 'all') {
      filtered = filtered.filter(t => t.merchant === filters.merchant);
    }
    
    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.accountingCategory === filters.category);
    }
    
    if (filters.memo) {
      filtered = filtered.filter(t => t.memo.toLowerCase().includes(filters.memo.toLowerCase()));
    }
    
    if (filters.spendCategory !== 'all') {
      filtered = filtered.filter(t => t.spendCategory === filters.spendCategory);
    }
    
    if (filters.spendProgram !== 'all') {
      filtered = filtered.filter(t => t.spendProgram === filters.spendProgram);
    }
    
    setFilteredData(filtered);
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const setDateRange = (range) => {
    const today = new Date();
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    let newFilters = { ...filters, month: 'all' };
    
    switch (range) {
      case 'last30':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        newFilters.dateFrom = formatDate(thirtyDaysAgo);
        newFilters.dateTo = formatDate(today);
        break;
      case 'thisquarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
        const quarterEnd = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
        newFilters.dateFrom = formatDate(quarterStart);
        newFilters.dateTo = formatDate(quarterEnd);
        break;
      case 'lastquarter':
        const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
        const lastQuarterYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
        const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
        const lastQuarterStart = new Date(lastQuarterYear, adjustedQuarter * 3, 1);
        const lastQuarterEnd = new Date(lastQuarterYear, (adjustedQuarter + 1) * 3, 0);
        newFilters.dateFrom = formatDate(lastQuarterStart);
        newFilters.dateTo = formatDate(lastQuarterEnd);
        break;
      case 'clear':
        newFilters.dateFrom = '';
        newFilters.dateTo = '';
        break;
    }
    
    setFilters(newFilters);
  };

  const showTransactionDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getUniqueValues = (field) => {
    return [...new Set(filteredData.map(t => t[field]))].sort();
  };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const ytdTotal = filteredData
    .filter(t => t.date.getFullYear() === currentYear)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const monthTotal = filteredData
    .filter(t => t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const reimbursementCount = filteredData.filter(t => t.type === 'expense').length;
  const receiptCount = data.receipts ? data.receipts.length : 0;

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
            <button className="btn-primary" onClick={fetchData}>Refresh Data</button>
          </div>
        </header>

        <main className="main">
          <div className="filters">
            <div className="filter-group">
              <label>Department:</label>
              <select value={filters.department} onChange={(e) => handleFilterChange('department', e.target.value)}>
                <option value="all">All Departments</option>
                {getUniqueValues('department').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Employee:</label>
              <select value={filters.employee} onChange={(e) => handleFilterChange('employee', e.target.value)}>
                <option value="all">All Employees</option>
                {getUniqueValues('employee').map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Month:</label>
              <select value={filters.month} onChange={(e) => handleFilterChange('month', e.target.value)}>
                <option value="all">All Months (YTD)</option>
                {Array.from({length: 12}, (_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  const monthName = new Date(2025, i, 1).toLocaleString('default', { month: 'long' });
                  return (
                    <option key={month} value={`2025-${month}`}>{monthName} 2025</option>
                  );
                })}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Merchant:</label>
              <select value={filters.merchant} onChange={(e) => handleFilterChange('merchant', e.target.value)}>
                <option value="all">All Merchants</option>
                {getUniqueValues('merchant').map(merchant => (
                  <option key={merchant} value={merchant}>{merchant}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Category:</label>
              <select value={filters.category} onChange={(e) => handleFilterChange('category', e.target.value)}>
                <option value="all">All Categories</option>
                {getUniqueValues('accountingCategory').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Memo Search:</label>
              <input 
                type="text" 
                className="text-input" 
                placeholder="Search memos..."
                value={filters.memo}
                onChange={(e) => handleFilterChange('memo', e.target.value)}
              />
            </div>
            
            <div className="filter-group">
              <label>Spend Category:</label>
              <select value={filters.spendCategory} onChange={(e) => handleFilterChange('spendCategory', e.target.value)}>
                <option value="all">All Spend Categories</option>
                {data.spendCategories.map(cat => (
                  <option key={cat.id || cat.name} value={cat.name || cat.display_name}>
                    {cat.name || cat.display_name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Spend Program:</label>
              <select value={filters.spendProgram} onChange={(e) => handleFilterChange('spendProgram', e.target.value)}>
                <option value="all">All Spend Programs</option>
                {data.spendPrograms.map(prog => (
                  <option key={prog.id || prog.name} value={prog.name || prog.display_name}>
                    {prog.name || prog.display_name || 'Unknown'}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>From Date:</label>
              <input 
                type="date" 
                className="date-input"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>
            
            <div className="filter-group">
              <label>To Date:</label>
              <input 
                type="date" 
                className="date-input"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>
            
            <div className="filter-group date-presets">
              <label>Quick Ranges:</label>
              <div className="preset-buttons">
                <button type="button" className="preset-btn" onClick={() => setDateRange('last30')}>Last 30 Days</button>
                <button type="button" className="preset-btn" onClick={() => setDateRange('thisquarter')}>This Quarter</button>
                <button type="button" className="preset-btn" onClick={() => setDateRange('lastquarter')}>Last Quarter</button>
                <button type="button" className="preset-btn" onClick={() => setDateRange('clear')}>Clear Dates</button>
              </div>
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
            <div className="card">
              <h3>Reimbursements</h3>
              <div className="count">{reimbursementCount.toLocaleString()}</div>
            </div>
            <div className="card">
              <h3>Receipts</h3>
              <div className="count">{receiptCount.toLocaleString()}</div>
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
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 50).map((transaction, index) => (
                    <tr key={transaction.id || index} onClick={() => showTransactionDetails(transaction)} style={{cursor: 'pointer'}}>
                      <td>{transaction.date.toLocaleDateString()}</td>
                      <td>{transaction.employee}</td>
                      <td>{transaction.department}</td>
                      <td>{transaction.merchant}</td>
                      <td className="amount-cell">{formatCurrency(transaction.amount)}</td>
                      <td>{transaction.location}</td>
                      <td>
                        <span className={`type-badge type-${transaction.type}`}>
                          {transaction.type === 'expense' ? 'Reimbursement' : 'Transaction'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{textAlign: 'center', color: '#6b7280', fontStyle: 'italic'}}>
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Transaction Details Modal */}
        {showModal && selectedTransaction && (
          <div className="modal" onClick={closeModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Transaction Details</h3>
                <button className="modal-close" onClick={closeModal}>&times;</button>
              </div>
              <div className="modal-body">
                <div className="detail-grid">
                  <div className="detail-label">Date:</div>
                  <div className="detail-value">{selectedTransaction.date.toLocaleDateString()}</div>
                  
                  <div className="detail-label">Employee:</div>
                  <div className="detail-value">{selectedTransaction.employee}</div>
                  
                  <div className="detail-label">Department:</div>
                  <div className="detail-value">{selectedTransaction.department}</div>
                  
                  <div className="detail-label">Amount:</div>
                  <div className="detail-value">{formatCurrency(selectedTransaction.amount)}</div>
                  
                  <div className="detail-label">Merchant:</div>
                  <div className="detail-value">{selectedTransaction.merchantDescriptor}</div>
                  
                  <div className="detail-label">Location:</div>
                  <div className="detail-value">{selectedTransaction.location}</div>
                  
                  <div className="detail-label">Employee Location:</div>
                  <div className="detail-value">{selectedTransaction.cardHolderLocation}</div>
                  
                  <div className="detail-label">Accounting Category:</div>
                  <div className="detail-value">{selectedTransaction.accountingCategory}</div>
                  
                  <div className="detail-label">Status:</div>
                  <div className="detail-value">
                    <span className={`type-badge type-${selectedTransaction.type}`}>
                      {selectedTransaction.state}
                    </span>
                  </div>
                  
                  <div className="detail-label">Type:</div>
                  <div className="detail-value">
                    <span className={`type-badge type-${selectedTransaction.type}`}>
                      {selectedTransaction.type === 'expense' ? 'Reimbursement' : 'Transaction'}
                    </span>
                  </div>
                  
                  <div className="detail-label">Memo:</div>
                  <div className="detail-value">{selectedTransaction.memo}</div>
                  
                  <div className="detail-label">Spend Category:</div>
                  <div className="detail-value">{selectedTransaction.spendCategory}</div>
                  
                  <div className="detail-label">Spend Program:</div>
                  <div className="detail-value">{selectedTransaction.spendProgram}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading data...</p>
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}
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
        
        .btn-primary:hover {
          background: #1d4ed8;
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
        
        .filter-group select, .text-input, .date-input {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background-color: white;
          font-size: 0.875rem;
          width: 100%;
        }
        
        .text-input:focus, .date-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        
        .date-presets {
          grid-column: span 2;
        }
        
        .preset-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-top: 0.25rem;
        }
        
        .preset-btn {
          padding: 0.375rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background-color: white;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .preset-btn:hover {
          background-color: #f3f4f6;
          border-color: #9ca3af;
        }
        
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
        
        .transactions-table {
          background: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
        }
        
        .transactions-table h2 {
          color: #374151;
          font-size: 1.2rem;
          font-weight: 600;
          margin-bottom: 1rem;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
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
        
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .modal-content {
          background: white;
          border-radius: 0.5rem;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .modal-header h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }
        
        .modal-close {
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #6b7280;
          padding: 0;
          width: 2rem;
          height: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .modal-close:hover {
          color: #374151;
        }
        
        .modal-body {
          padding: 1.5rem;
        }
        
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        
        .detail-label {
          font-weight: 600;
          color: #374151;
        }
        
        .detail-value {
          color: #6b7280;
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
        
        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .filters {
            grid-template-columns: 1fr;
          }
          
          .date-presets {
            grid-column: span 1;
          }
          
          .preset-buttons {
            justify-content: center;
          }
          
          .summary-cards {
            grid-template-columns: repeat(2, 1fr);
          }
          
          .main {
            padding: 0 1rem;
          }
          
          .table-container {
            font-size: 0.8rem;
          }
          
          .modal-content {
            width: 95%;
            margin: 1rem;
          }
        }
      `}</style>
    </>
  );
}
