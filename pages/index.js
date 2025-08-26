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
      const response = await fetch('/api/ramp-data');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const fetchedData = await response.json();
      
      const newData = {
        expenses: Array.isArray(fetchedData.expenses) ? fetchedData.expenses : [],
        transactions: Array.isArray(fetchedData.transactions) ? fetchedData.transactions : [],
        spendCategories: Array.isArray(fetchedData.spendCategories) ? fetchedData.spendCategories : [],
        spendPrograms: Array.isArray(fetchedData.spendPrograms) ? fetchedData.spendPrograms : [],
        receipts: Array.isArray(fetchedData.receipts) ? fetchedData.receipts : [],
        memos: Array.isArray(fetchedData.memos) ? fetchedData.memos : [],
        lastUpdated: new Date().toISOString()
      };
      
      setData(newData);
      
      // Cache the data
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('te-dashboard-data', JSON.stringify(newData));
        } catch (storageError) {
          console.warn('Failed to cache data:', storageError);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch fresh data. Showing cached data if available.');
    } finally {
      setLoading(false);
    }
  };

  const getSpendProgramName = (spendProgramId) => {
    if (!spendProgramId || !Array.isArray(data.spendPrograms)) return 'No Program';
    const program = data.spendPrograms.find(p => p && p.id === spendProgramId);
    return program ? (program.name || program.display_name || 'Unknown Program') : 'No Program';
  };

  const getReceiptInfo = (transactionId) => {
    if (!transactionId || !Array.isArray(data.receipts)) return { hasReceipt: false, receiptUrl: null };
    
    // Find receipt that matches this transaction
    const receipt = data.receipts.find(r => 
      r && (r.transaction_id === transactionId || r.expense_id === transactionId)
    );
    
    if (receipt) {
      return {
        hasReceipt: true,
        receiptUrl: receipt.receipt_url || receipt.image_url || receipt.url || null,
        receiptId: receipt.id
      };
    }
    
    return { hasReceipt: false, receiptUrl: null };
  };

  const processData = () => {
    const allTransactions = [];
    
    try {
      // Process expenses (reimbursements)
      if (Array.isArray(data.expenses)) {
        data.expenses.forEach(expense => {
          if (!expense) return;
          
          try {
            const glAccount = expense.accounting_field_selections?.find(cat => 
              cat && cat.type === 'GL_ACCOUNT'
            ) || expense.line_items?.[0]?.accounting_field_selections?.find(cat => 
              cat && cat.type === 'GL_ACCOUNT'
            );
            
            const location = expense.start_location || expense.end_location || 'Unknown';
            const receiptInfo = getReceiptInfo(expense.id);
            
            allTransactions.push({
              id: expense.id || `expense-${Math.random()}`,
              date: new Date(expense.transaction_date || expense.created_at || Date.now()),
              amount: typeof expense.amount === 'number' ? expense.amount : 0,
              currency: expense.currency || 'USD',
              employee: expense.user_full_name || 'Unknown',
              department: expense.line_items?.[0]?.accounting_field_selections?.find(cat => 
                cat && cat.type === 'OTHER' && cat.category_info?.name === 'Department'
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
              spendProgram: getSpendProgramName(expense.spend_program_id),
              hasReceipt: receiptInfo.hasReceipt,
              receiptUrl: receiptInfo.receiptUrl
            });
          } catch (expenseError) {
            console.warn('Error processing expense:', expenseError, expense);
          }
        });
      }
      
      // Process transactions
      if (Array.isArray(data.transactions)) {
        data.transactions.forEach(transaction => {
          if (!transaction) return;
          
          try {
            const glAccount = transaction.accounting_categories?.find(cat => 
              cat && cat.tracking_category_remote_type === 'GL_ACCOUNT'
            );
            
            const merchantLocation = transaction.merchant_location;
            const locationString = merchantLocation ? 
              [merchantLocation.city, merchantLocation.state, merchantLocation.country]
                .filter(Boolean).join(', ') || 'Unknown' : 'Unknown';
            
            const receiptInfo = getReceiptInfo(transaction.id);
            
            allTransactions.push({
              id: transaction.id || `transaction-${Math.random()}`,
              date: new Date(transaction.user_transaction_time || Date.now()),
              amount: typeof transaction.amount === 'number' ? transaction.amount : 0,
              currency: transaction.currency_code || 'USD',
              employee: transaction.card_holder ? 
                `${transaction.card_holder.first_name || ''} ${transaction.card_holder.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
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
              spendProgram: getSpendProgramName(transaction.spend_program_id),
              hasReceipt: receiptInfo.hasReceipt,
              receiptUrl: receiptInfo.receiptUrl
            });
          } catch (transactionError) {
            console.warn('Error processing transaction:', transactionError, transaction);
          }
        });
      }
    } catch (processError) {
      console.error('Error in processData:', processError);
    }
    
    // Sort by date (newest first)
    allTransactions.sort((a, b) => {
      try {
        return b.date.getTime() - a.date.getTime();
      } catch (sortError) {
        return 0;
      }
    });
    
    return allTransactions;
  };

  const applyFilters = () => {
    try {
      const processed = processData();
      let filtered = [...processed];
      
      if (filters.department.length > 0) {
        filtered = filtered.filter(t => t && filters.department.includes(t.department));
      }
      
      if (filters.employee.length > 0) {
        filtered = filtered.filter(t => t && filters.employee.includes(t.employee));
      }
      
      if (filters.month !== 'all') {
        const [year, month] = filters.month.split('-');
        if (year && month) {
          filtered = filtered.filter(t => {
            if (!t || !t.date) return false;
            try {
              const transactionYear = t.date.getFullYear();
              const transactionMonth = t.date.getMonth() + 1;
              return transactionYear === parseInt(year) && transactionMonth === parseInt(month);
            } catch (dateError) {
              return false;
            }
          });
        }
      } else {
        if (filters.dateFrom) {
          try {
            const fromDate = new Date(filters.dateFrom);
            filtered = filtered.filter(t => t && t.date && t.date >= fromDate);
          } catch (dateError) {
            console.warn('Invalid from date:', filters.dateFrom);
          }
        }
        
        if (filters.dateTo) {
          try {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => t && t.date && t.date <= toDate);
          } catch (dateError) {
            console.warn('Invalid to date:', filters.dateTo);
          }
        }
      }
      
      if (filters.merchant.length > 0) {
        filtered = filtered.filter(t => t && filters.merchant.includes(t.merchant));
      }
      
      if (filters.category.length > 0) {
        filtered = filtered.filter(t => t && filters.category.includes(t.accountingCategory));
      }
      
      if (filters.memo && filters.memo.trim()) {
        const memoLower = filters.memo.toLowerCase().trim();
        filtered = filtered.filter(t => t && t.memo && t.memo.toLowerCase().includes(memoLower));
      }
      
      if (filters.spendProgram.length > 0) {
        filtered = filtered.filter(t => t && filters.spendProgram.includes(t.spendProgram));
      }
      
      setFilteredData(filtered);
    } catch (filterError) {
      console.error('Error in applyFilters:', filterError);
      setFilteredData([]);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleMultiSelectChange = (filterName, value, isSelected) => {
    setFilters(prev => {
      const currentValues = prev[filterName] || [];
      if (isSelected) {
        return { ...prev, [filterName]: [...currentValues, value] };
      } else {
        return { ...prev, [filterName]: currentValues.filter(v => v !== value) };
      }
    });
  };

  const clearAllFilters = () => {
    setFilters({
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
  };

  const MultiSelectFilter = ({ label, filterName, options, selectedValues }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    
    const filteredOptions = options.filter(option => 
      option.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return (
      <div className="filter-group">
        <label>{label}:</label>
        <div className="multi-select-container">
          <div className="multi-select-header" onClick={() => setIsOpen(!isOpen)}>
            <span className="selected-count">
              {selectedValues.length === 0 ? `All ${label}s` : `${selectedValues.length} selected`}
            </span>
            <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
          </div>
          {isOpen && (
            <div className="multi-select-dropdown">
              <input
                type="text"
                className="search-input"
                placeholder={`Search ${label.toLowerCase()}s...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="options-container">
                {filteredOptions.map(option => (
                  <label key={option} className="option-item">
                    <input
                      type="checkbox"
                      checked={selectedValues.includes(option)}
                      onChange={(e) => handleMultiSelectChange(filterName, option, e.target.checked)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
                {filteredOptions.length === 0 && (
                  <div className="no-options">No matches found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const setDateRange = (range) => {
    try {
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
    } catch (dateRangeError) {
      console.error('Error setting date range:', dateRangeError);
    }
  };

  const showTransactionDetails = (transaction) => {
    if (transaction) {
      setSelectedTransaction(transaction);
      setShowModal(true);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTransaction(null);
  };

  const formatCurrency = (amount) => {
    try {
      const numAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(numAmount);
    } catch (formatError) {
      return '$0.00';
    }
  };

  const getUniqueValues = (field) => {
    try {
      if (!Array.isArray(filteredData)) return [];
      return [...new Set(filteredData.map(t => t && t[field]).filter(Boolean))].sort();
    } catch (uniqueError) {
      console.warn('Error getting unique values for', field, uniqueError);
      return [];
    }
  };

  // Calculate summary statistics
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  
  const ytdTotal = Array.isArray(filteredData) ? filteredData
    .filter(t => t && t.date && t.date.getFullYear() === currentYear)
    .reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0) : 0;
  
  const monthTotal = Array.isArray(filteredData) ? filteredData
    .filter(t => t && t.date && t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth)
    .reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0) : 0;
  
  const reimbursementCount = Array.isArray(filteredData) ? filteredData.filter(t => t && t.type === 'expense').length : 0;
  const receiptCount = Array.isArray(data.receipts) ? data.receipts.length : 0;

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
          
          <div className="filters">
            <div className="filter-section">
              <h3 className="filter-section-title">Basic Filters</h3>
              <div className="filter-row">
                <MultiSelectFilter 
                  label="Department" 
                  filterName="department" 
                  options={getUniqueValues('department')} 
                  selectedValues={filters.department}
                />
                
                <MultiSelectFilter 
                  label="Employee" 
                  filterName="employee" 
                  options={getUniqueValues('employee')} 
                  selectedValues={filters.employee}
                />
                
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
              </div>
            </div>
            
            <div className="filter-section">
              <h3 className="filter-section-title">Transaction Details</h3>
              <div className="filter-row">
                <MultiSelectFilter 
                  label="Merchant" 
                  filterName="merchant" 
                  options={getUniqueValues('merchant')} 
                  selectedValues={filters.merchant}
                />
                
                <MultiSelectFilter 
                  label="Category" 
                  filterName="category" 
                  options={getUniqueValues('accountingCategory')} 
                  selectedValues={filters.category}
                />
                
                <MultiSelectFilter 
                  label="Spend Program" 
                  filterName="spendProgram" 
                  options={Array.isArray(data.spendPrograms) ? data.spendPrograms.map(prog => prog.name || prog.display_name || 'Unknown').filter(Boolean) : []}
                  selectedValues={filters.spendProgram}
                />
              </div>
            </div>
            
            <div className="filter-section">
              <h3 className="filter-section-title">Search & Date Range</h3>
              <div className="filter-row">
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
              </div>
              
              <div className="filter-row">
                <div className="filter-group date-presets">
                  <label>Quick Ranges:</label>
                  <div className="preset-buttons">
                    <button type="button" className="preset-btn" onClick={() => setDateRange('last30')}>Last 30 Days</button>
                    <button type="button" className="preset-btn" onClick={() => setDateRange('thisquarter')}>This Quarter</button>
                    <button type="button" className="preset-btn" onClick={() => setDateRange('lastquarter')}>Last Quarter</button>
                    <button type="button" className="preset-btn" onClick={() => setDateRange('clear')}>Clear Dates</button>
                  </div>
                </div>
                
                <div className="filter-group clear-all">
                  <label>&nbsp;</label>
                  <button type="button" className="clear-all-btn" onClick={clearAllFilters}>
                    Clear All Filters
                  </button>
                </div>
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
              <div className="count">{Array.isArray(filteredData) ? filteredData.length.toLocaleString() : '0'}</div>
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
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Location</th>
                    <th>Memo</th>
                    <th>Receipt</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(filteredData) && filteredData.slice(0, 50).map((transaction, index) => (
                    <tr key={transaction.id || index} onClick={() => showTransactionDetails(transaction)} style={{cursor: 'pointer'}}>
                      <td>{transaction.date ? transaction.date.toLocaleDateString() : 'Unknown'}</td>
                      <td>{transaction.employee || 'Unknown'}</td>
                      <td>{transaction.department || 'Unknown'}</td>
                      <td>{transaction.merchant || 'Unknown'}</td>
                      <td>{transaction.accountingCategory || 'Unknown'}</td>
                      <td className="amount-cell">{formatCurrency(transaction.amount)}</td>
                      <td>{transaction.location || 'Unknown'}</td>
                      <td>{transaction.memo || 'No memo'}</td>
                      <td className="receipt-status" style={{position: 'relative'}}>
                        <span 
                          className={transaction.hasReceipt && transaction.receiptUrl ? 'receipt-with-image' : ''}
                          title={transaction.hasReceipt && transaction.receiptUrl ? 'Hover to preview, click to open full size' : (transaction.hasReceipt ? 'Has Receipt' : 'No Receipt')}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (transaction.hasReceipt && transaction.receiptUrl) {
                              window.open(transaction.receiptUrl, '_blank', 'width=800,height=1000,scrollbars=yes,resizable=yes');
                            }
                          }}
                          style={{cursor: transaction.hasReceipt && transaction.receiptUrl ? 'pointer' : 'default'}}
                        >
                          {transaction.hasReceipt ? '✅' : '❌'}
                        </span>
                        {transaction.hasReceipt && transaction.receiptUrl && (
                          <div className="receipt-preview">
                            <img src={transaction.receiptUrl} alt="Receipt" onError={(e) => e.target.style.display = 'none'} />
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`type-badge type-${transaction.type || 'unknown'}`}>
                          {transaction.type === 'expense' ? 'Reimbursement' : 'Transaction'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!Array.isArray(filteredData) || filteredData.length === 0) && (
                    <tr>
                      <td colSpan="10" style={{textAlign: 'center', color: '#6b7280', fontStyle: 'italic'}}>
                        {loading ? 'Loading transactions...' : 'No transactions found'}
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
                  <div className="detail-value">{selectedTransaction.date ? selectedTransaction.date.toLocaleDateString() : 'Unknown'}</div>
                  
                  <div className="detail-label">Employee:</div>
                  <div className="detail-value">{selectedTransaction.employee || 'Unknown'}</div>
                  
                  <div className="detail-label">Department:</div>
                  <div className="detail-value">{selectedTransaction.department || 'Unknown'}</div>
                  
                  <div className="detail-label">Amount:</div>
                  <div className="detail-value">{formatCurrency(selectedTransaction.amount)}</div>
                  
                  <div className="detail-label">Merchant:</div>
                  <div className="detail-value">{selectedTransaction.merchantDescriptor || 'Unknown'}</div>
                  
                  <div className="detail-label">Location:</div>
                  <div className="detail-value">{selectedTransaction.location || 'Unknown'}</div>
                  
                  <div className="detail-label">Employee Location:</div>
                  <div className="detail-value">{selectedTransaction.cardHolderLocation || 'Unknown'}</div>
                  
                  <div className="detail-label">Accounting Category:</div>
                  <div className="detail-value">{selectedTransaction.accountingCategory || 'Unknown'}</div>
                  
                  <div className="detail-label">Status:</div>
                  <div className="detail-value">
                    <span className={`type-badge type-${selectedTransaction.type || 'unknown'}`}>
                      {selectedTransaction.state || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="detail-label">Type:</div>
                  <div className="detail-value">
                    <span className={`type-badge type-${selectedTransaction.type || 'unknown'}`}>
                      {selectedTransaction.type === 'expense' ? 'Reimbursement' : 'Transaction'}
                    </span>
                  </div>
                  
                  <div className="detail-label">Memo:</div>
                  <div className="detail-value">{selectedTransaction.memo || 'No memo'}</div>
                  
                  <div className="detail-label">Spend Category:</div>
                  <div className="detail-value">{selectedTransaction.spendCategory || 'Unknown'}</div>
                  
                  <div className="detail-label">Spend Program:</div>
                  <div className="detail-value">{selectedTransaction.spendProgram || 'Unknown'}</div>
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
        }
        
        .filter-section {
          margin-bottom: 1.5rem;
        }
        
        .filter-section:last-child {
          margin-bottom: 0;
        }
        
        .filter-section-title {
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          margin: 0 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .filter-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .filter-row:last-child {
          margin-bottom: 0;
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
        
        .receipt-with-image {
          cursor: help;
        }
        
        .receipt-preview {
          position: absolute;
          top: -10px;
          left: 100%;
          z-index: 1000;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          padding: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.3s, visibility 0.3s;
          pointer-events: none;
          max-width: 300px;
        }
        
        .receipt-status:hover .receipt-preview {
          opacity: 1;
          visibility: visible;
        }
        
        .receipt-preview img {
          max-width: 280px;
          max-height: 400px;
          width: auto;
          height: auto;
          border-radius: 4px;
        }
        
        .receipt-status {
          text-align: center;
          font-size: 1.2rem;
        }
        
        .multi-select-container {
          position: relative;
        }
        
        .multi-select-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background-color: white;
          cursor: pointer;
          font-size: 0.875rem;
        }
        
        .multi-select-header:hover {
          border-color: #9ca3af;
        }
        
        .selected-count {
          color: #374151;
        }
        
        .dropdown-arrow {
          color: #6b7280;
          font-size: 0.75rem;
        }
        
        .multi-select-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 1000;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          max-height: 200px;
          overflow-y: auto;
        }
        
        .search-input {
          width: 100%;
          padding: 0.5rem;
          border: none;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.875rem;
          outline: none;
        }
        
        .search-input:focus {
          border-bottom-color: #3b82f6;
        }
        
        .options-container {
          max-height: 150px;
          overflow-y: auto;
        }
        
        .option-item {
          display: flex;
          align-items: center;
          padding: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
        }
        
        .option-item:hover {
          background-color: #f3f4f6;
        }
        
        .option-item input[type="checkbox"] {
          margin-right: 0.5rem;
        }
        
        .no-options {
          padding: 0.5rem;
          text-align: center;
          color: #6b7280;
          font-style: italic;
          font-size: 0.875rem;
        }
        
        .clear-all {
          display: flex;
          align-items: end;
        }
        
        .clear-all-btn {
          padding: 0.75rem 1.5rem;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }
        
        .clear-all-btn:hover {
          background: #b91c1c;
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
          margin: 0 0 2rem 0;
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
            padding: 1rem;
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