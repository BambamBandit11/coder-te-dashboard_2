class TEDashboard {
    constructor() {
        this.data = {
            expenses: [],
            transactions: [],
            lastUpdated: null
        };
        this.filteredData = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();
        this.populateMonthFilter();
    }

    bindEvents() {
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshData());
        document.getElementById('export-csv').addEventListener('click', () => this.exportToCSV());
        document.getElementById('department-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('employee-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('month-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('merchant-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('category-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('date-from').addEventListener('change', () => this.applyFilters());
        document.getElementById('date-to').addEventListener('change', () => this.applyFilters());
        document.getElementById('memo-filter').addEventListener('input', () => this.applyFilters());
        document.getElementById('spend-category-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('spend-program-filter').addEventListener('change', () => this.applyFilters());
        
        // Preset date range buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setDateRange(e.target.dataset.range));
        });
        
        // Modal events
        document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
        document.getElementById('transaction-modal').addEventListener('click', (e) => {
            if (e.target.id === 'transaction-modal') {
                this.closeModal();
            }
        });
    }

    async loadData() {
        try {
            // Try to load cached data first
            const cachedData = localStorage.getItem('te-dashboard-data');
            if (cachedData) {
                const parsed = JSON.parse(cachedData);
                this.data = parsed;
                this.updateLastUpdated();
                this.processData();
            }
            
            // Always try to fetch fresh data
            await this.fetchData();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data');
        }
    }

    async fetchData() {
        this.showLoading(true);
        try {
            const response = await fetch('/api/ramp-data');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            this.data = {
                expenses: data.expenses || [],
                transactions: data.transactions || [],
                spendCategories: data.spendCategories || [],
                spendPrograms: data.spendPrograms || [],
                receipts: data.receipts || [],
                memos: data.memos || [],
                lastUpdated: new Date().toISOString()
            };
            
            // Cache the data
            localStorage.setItem('te-dashboard-data', JSON.stringify(this.data));
            
            this.updateLastUpdated();
            this.processData();
        } catch (error) {
            console.error('Error fetching data:', error);
            this.showError('Failed to fetch fresh data. Showing cached data if available.');
        } finally {
            this.showLoading(false);
        }
    }

    async refreshData() {
        await this.fetchData();
    }

    processData() {
        // Combine expenses and transactions into a unified format
        const allTransactions = [];
        
        // Process expenses
        this.data.expenses.forEach(expense => {
            // Extract accounting category (GL Account) for expenses
            // Reimbursements use accounting_field_selections instead of accounting_categories
            const glAccount = expense.accounting_field_selections?.find(cat => 
                cat.type === 'GL_ACCOUNT'
            ) || expense.line_items?.[0]?.accounting_field_selections?.find(cat => 
                cat.type === 'GL_ACCOUNT'
            );
            
            // Extract location information - reimbursements have different structure
            const location = expense.start_location || expense.end_location || 'Unknown';
            
            allTransactions.push({
                id: expense.id,
                date: new Date(expense.transaction_date || expense.created_at),
                amount: expense.amount, // Reimbursements are already in dollars
                currency: expense.currency || 'USD',
                employee: expense.user_full_name || 'Unknown',
                department: expense.line_items?.[0]?.accounting_field_selections?.find(cat => 
                    cat.type === 'OTHER' && cat.category_info?.name === 'Department'
                )?.name || 'Unknown',
                merchant: expense.merchant || 'Unknown',
                location: location,
                type: 'expense',
                // Enhanced fields
                accountingCategory: glAccount?.name || 'Uncategorized',
                merchantDescriptor: expense.merchant || 'Unknown',
                state: expense.state || 'Unknown',
                cardHolderLocation: 'N/A', // Reimbursements don't have card holder location
                memo: expense.memo || 'No memo',
                spendCategory: 'Reimbursement', // Reimbursements don't have spend categories
                spendProgram: this.getSpendProgramName(expense.spend_program_id) || 'No Program'
            });
        });
        
        // Process transactions
        this.data.transactions.forEach(transaction => {
            // Extract accounting category (GL Account)
            const glAccount = transaction.accounting_categories?.find(cat => 
                cat.tracking_category_remote_type === 'GL_ACCOUNT'
            );
            
            // Extract merchant location
            const merchantLocation = transaction.merchant_location;
            const locationString = [merchantLocation?.city, merchantLocation?.state, merchantLocation?.country]
                .filter(Boolean).join(', ') || 'Unknown';
            
            allTransactions.push({
                id: transaction.id,
                date: new Date(transaction.user_transaction_time),
                amount: transaction.amount / 100, // Convert cents to dollars
                currency: transaction.currency_code || 'USD',
                employee: transaction.card_holder ? 
                    `${transaction.card_holder.first_name} ${transaction.card_holder.last_name}` : 'Unknown',
                department: transaction.card_holder?.department_name || 'Unknown',
                merchant: transaction.merchant_name || 'Unknown',
                location: locationString,
                type: 'transaction',
                // Enhanced fields
                accountingCategory: glAccount?.category_name || 'Uncategorized',
                merchantDescriptor: transaction.merchant_descriptor || transaction.merchant_name || 'Unknown',
                state: transaction.state || 'Unknown',
                cardHolderLocation: transaction.card_holder?.location_name || 'Unknown',
                memo: transaction.memo || 'No memo',
                spendCategory: transaction.sk_category_name || 'Uncategorized',
                spendProgram: this.getSpendProgramName(transaction.spend_program_id) || 'No Program'
            });
        });
        
        // Sort by date (newest first)
        allTransactions.sort((a, b) => b.date - a.date);
        
        this.filteredData = allTransactions;
        this.populateFilters();
        this.applyFilters();
    }

    populateFilters() {
        const departments = [...new Set(this.filteredData.map(t => t.department))].sort();
        const employees = [...new Set(this.filteredData.map(t => t.employee))].sort();
        const merchants = [...new Set(this.filteredData.map(t => t.merchant))].sort();
        const categories = [...new Set(this.filteredData.map(t => t.accountingCategory))].sort();
        
        this.populateSelect('department-filter', departments);
        this.populateSelect('employee-filter', employees);
        this.populateSelect('merchant-filter', merchants);
        this.populateSelect('category-filter', categories);
        
        // Populate spend categories from API data
        const spendCategories = this.data.spendCategories.map(cat => cat.name || cat.display_name || 'Unknown').sort();
        this.populateSelect('spend-category-filter', spendCategories);
        
        // Populate spend programs from API data
        const spendPrograms = this.data.spendPrograms.map(prog => prog.name || prog.display_name || 'Unknown').sort();
        this.populateSelect('spend-program-filter', spendPrograms);
    }

    populateSelect(selectId, options) {
        const select = document.getElementById(selectId);
        const currentValue = select.value;
        
        // Keep the "All" option and add new options
        const allOption = select.querySelector('option[value="all"]');
        select.innerHTML = '';
        select.appendChild(allOption);
        
        options.forEach(option => {
            if (option && option !== 'Unknown') {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            }
        });
        
        // Restore previous selection if it still exists
        if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    }

    populateMonthFilter() {
        const select = document.getElementById('month-filter');
        const currentYear = new Date().getFullYear();
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        months.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
            option.textContent = `${month} ${currentYear}`;
            select.appendChild(option);
        });
    }

    applyFilters() {
        const departmentFilter = document.getElementById('department-filter').value;
        const employeeFilter = document.getElementById('employee-filter').value;
        const monthFilter = document.getElementById('month-filter').value;
        const merchantFilter = document.getElementById('merchant-filter').value;
        const categoryFilter = document.getElementById('category-filter').value;
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const memoFilter = document.getElementById('memo-filter').value.toLowerCase().trim();
        const spendCategoryFilter = document.getElementById('spend-category-filter').value;
        const spendProgramFilter = document.getElementById('spend-program-filter').value;
        
        let filtered = [...this.filteredData];
        
        if (departmentFilter !== 'all') {
            filtered = filtered.filter(t => t.department === departmentFilter);
        }
        
        if (employeeFilter !== 'all') {
            filtered = filtered.filter(t => t.employee === employeeFilter);
        }
        
        // Apply month filter (takes precedence over date range if both are set)
        if (monthFilter !== 'all') {
            const [year, month] = monthFilter.split('-');
            filtered = filtered.filter(t => {
                const transactionYear = t.date.getFullYear();
                const transactionMonth = t.date.getMonth() + 1;
                return transactionYear === parseInt(year) && transactionMonth === parseInt(month);
            });
        } else {
            // Apply date range filter only if month filter is not set
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                filtered = filtered.filter(t => t.date >= fromDate);
            }
            
            if (dateTo) {
                const toDate = new Date(dateTo);
                toDate.setHours(23, 59, 59, 999); // Include the entire end date
                filtered = filtered.filter(t => t.date <= toDate);
            }
        }
        
        if (merchantFilter !== 'all') {
            filtered = filtered.filter(t => t.merchant === merchantFilter);
        }
        
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(t => t.accountingCategory === categoryFilter);
        }
        
        if (memoFilter) {
            filtered = filtered.filter(t => t.memo.toLowerCase().includes(memoFilter));
        }
        
        if (spendCategoryFilter !== 'all') {
            filtered = filtered.filter(t => t.spendCategory === spendCategoryFilter);
        }
        
        if (spendProgramFilter !== 'all') {
            filtered = filtered.filter(t => t.spendProgram === spendProgramFilter);
        }
        
        this.updateSummary(filtered);
        this.updateDepartmentChart(filtered);
        this.updateMonthlyChart(filtered);
        this.updateTransactionsTable(filtered);
    }

    updateSummary(data) {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        
        // Calculate YTD total
        const ytdTotal = data
            .filter(t => t.date.getFullYear() === currentYear)
            .reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate current month total
        const monthTotal = data
            .filter(t => t.date.getFullYear() === currentYear && t.date.getMonth() === currentMonth)
            .reduce((sum, t) => sum + t.amount, 0);
        
        // Calculate reimbursement count
        const reimbursementCount = data.filter(t => t.type === 'expense').length;
        
        // Calculate receipts count from API data
        const receiptCount = this.data.receipts ? this.data.receipts.length : 0;
        
        document.getElementById('total-spend').textContent = this.formatCurrency(ytdTotal);
        document.getElementById('month-spend').textContent = this.formatCurrency(monthTotal);
        document.getElementById('transaction-count').textContent = data.length.toLocaleString();
        document.getElementById('reimbursement-count').textContent = reimbursementCount.toLocaleString();
        document.getElementById('receipt-count').textContent = receiptCount.toLocaleString();
    }

    updateDepartmentChart(data) {
        const departmentTotals = {};
        data.forEach(t => {
            departmentTotals[t.department] = (departmentTotals[t.department] || 0) + t.amount;
        });
        
        const sortedDepartments = Object.entries(departmentTotals)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // Top 10 departments
        
        const maxAmount = Math.max(...sortedDepartments.map(([,amount]) => amount));
        
        const chartContainer = document.getElementById('department-chart');
        chartContainer.innerHTML = '';
        
        if (sortedDepartments.length === 0) {
            chartContainer.innerHTML = '<p>No data available</p>';
            return;
        }
        
        sortedDepartments.forEach(([department, amount]) => {
            const barContainer = document.createElement('div');
            barContainer.className = 'department-bar';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'department-name';
            nameDiv.textContent = department;
            
            const barFill = document.createElement('div');
            barFill.className = 'department-bar-fill';
            barFill.style.width = `${(amount / maxAmount) * 100}%`;
            
            const amountDiv = document.createElement('div');
            amountDiv.className = 'department-amount';
            amountDiv.textContent = this.formatCurrency(amount);
            
            barContainer.appendChild(nameDiv);
            barContainer.appendChild(barFill);
            barContainer.appendChild(amountDiv);
            
            chartContainer.appendChild(barContainer);
        });
    }

    updateMonthlyChart(data) {
        const monthlyTotals = {};
        const currentYear = new Date().getFullYear();
        
        // Initialize all months of current year
        for (let i = 0; i < 12; i++) {
            const monthKey = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
            monthlyTotals[monthKey] = 0;
        }
        
        // Aggregate data by month
        data.forEach(t => {
            if (t.date.getFullYear() === currentYear) {
                const monthKey = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
                monthlyTotals[monthKey] += t.amount;
            }
        });
        
        const chartContainer = document.getElementById('monthly-chart');
        chartContainer.innerHTML = '';
        
        // Show a simple text summary
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const summaryDiv = document.createElement('div');
        summaryDiv.style.display = 'grid';
        summaryDiv.style.gridTemplateColumns = 'repeat(auto-fit, minmax(100px, 1fr))';
        summaryDiv.style.gap = '1rem';
        summaryDiv.style.marginTop = '1rem';
        
        Object.entries(monthlyTotals).forEach(([monthKey, amount], index) => {
            const monthDiv = document.createElement('div');
            monthDiv.style.textAlign = 'center';
            monthDiv.style.padding = '0.5rem';
            monthDiv.style.background = '#f9fafb';
            monthDiv.style.borderRadius = '6px';
            
            monthDiv.innerHTML = `
                <div style="font-size: 0.8rem; color: #6b7280; margin-bottom: 0.25rem;">${monthNames[index]}</div>
                <div style="font-weight: 600; color: #059669;">${this.formatCurrency(amount)}</div>
            `;
            
            summaryDiv.appendChild(monthDiv);
        });
        
        chartContainer.appendChild(summaryDiv);
    }

    updateTransactionsTable(data) {
        const tbody = document.querySelector('#transactions tbody');
        tbody.innerHTML = '';
        
        // Show latest 50 transactions
        const recentTransactions = data.slice(0, 50);
        
        recentTransactions.forEach((transaction, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${transaction.date.toLocaleDateString()}</td>
                <td>${transaction.employee}</td>
                <td>${transaction.department}</td>
                <td>${transaction.merchant}</td>
                <td class="amount-cell">${this.formatCurrency(transaction.amount)}</td>
                <td>${transaction.location}</td>
                <td><span class="type-badge type-${transaction.type}">${transaction.type === 'expense' ? 'Reimbursement' : 'Transaction'}</span></td>
            `;
            
            // Add click handler to show transaction details
            row.addEventListener('click', () => this.showTransactionDetails(transaction));
            
            tbody.appendChild(row);
        });
        
        if (recentTransactions.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="7" style="text-align: center; color: #6b7280; font-style: italic;">No transactions found</td>';
            tbody.appendChild(row);
        }
    }
    
    showTransactionDetails(transaction) {
        const modal = document.getElementById('transaction-modal');
        const modalBody = document.getElementById('modal-body');
        
        modalBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-label">Date:</div>
                <div class="detail-value">${transaction.date.toLocaleDateString()}</div>
                
                <div class="detail-label">Employee:</div>
                <div class="detail-value">${transaction.employee}</div>
                
                <div class="detail-label">Department:</div>
                <div class="detail-value">${transaction.department}</div>
                
                <div class="detail-label">Amount:</div>
                <div class="detail-value">${this.formatCurrency(transaction.amount)}</div>
                
                <div class="detail-label">Merchant:</div>
                <div class="detail-value">${transaction.merchantDescriptor}</div>
                
                <div class="detail-label">Location:</div>
                <div class="detail-value">${transaction.location}</div>
                
                <div class="detail-label">Employee Location:</div>
                <div class="detail-value">${transaction.cardHolderLocation}</div>
                
                <div class="detail-label">Accounting Category:</div>
                <div class="detail-value">${transaction.accountingCategory}</div>
                
                <div class="detail-label">Status:</div>
                <div class="detail-value"><span class="type-badge type-${transaction.type}">${transaction.state}</span></div>
                
                <div class="detail-label">Type:</div>
                <div class="detail-value"><span class="type-badge type-${transaction.type}">${transaction.type === 'expense' ? 'Reimbursement' : 'Transaction'}</span></div>
                
                <div class="detail-label">Memo:</div>
                <div class="detail-value">${transaction.memo}</div>
                
                <div class="detail-label">Spend Category:</div>
                <div class="detail-value">${transaction.spendCategory}</div>
                
                <div class="detail-label">Spend Program:</div>
                <div class="detail-value">${transaction.spendProgram}</div>
            </div>
        `;
        
        modal.classList.remove('hidden');
    }
    
    closeModal() {
        document.getElementById('transaction-modal').classList.add('hidden');
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    updateLastUpdated() {
        const lastUpdatedElement = document.getElementById('last-updated');
        if (this.data.lastUpdated) {
            const date = new Date(this.data.lastUpdated);
            lastUpdatedElement.textContent = `Last updated: ${date.toLocaleString()}`;
        }
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        const refreshBtn = document.getElementById('refresh-btn');
        
        if (show) {
            loadingElement.classList.remove('hidden');
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Refreshing...';
        } else {
            loadingElement.classList.add('hidden');
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Refresh Data';
        }
    }

    showError(message) {
        const errorElement = document.getElementById('error');
        errorElement.querySelector('p').textContent = message;
        errorElement.classList.remove('hidden');
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.classList.add('hidden');
        }, 5000);
    }

    setDateRange(range) {
        const dateFrom = document.getElementById('date-from');
        const dateTo = document.getElementById('date-to');
        const monthFilter = document.getElementById('month-filter');
        
        // Clear month filter when using date ranges
        monthFilter.value = 'all';
        
        const today = new Date();
        const formatDate = (date) => date.toISOString().split('T')[0];
        
        switch (range) {
            case 'last30':
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(today.getDate() - 30);
                dateFrom.value = formatDate(thirtyDaysAgo);
                dateTo.value = formatDate(today);
                break;
                
            case 'thisquarter':
                const currentQuarter = Math.floor(today.getMonth() / 3);
                const quarterStart = new Date(today.getFullYear(), currentQuarter * 3, 1);
                const quarterEnd = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
                dateFrom.value = formatDate(quarterStart);
                dateTo.value = formatDate(quarterEnd);
                break;
                
            case 'lastquarter':
                const lastQuarter = Math.floor(today.getMonth() / 3) - 1;
                const lastQuarterYear = lastQuarter < 0 ? today.getFullYear() - 1 : today.getFullYear();
                const adjustedQuarter = lastQuarter < 0 ? 3 : lastQuarter;
                const lastQuarterStart = new Date(lastQuarterYear, adjustedQuarter * 3, 1);
                const lastQuarterEnd = new Date(lastQuarterYear, (adjustedQuarter + 1) * 3, 0);
                dateFrom.value = formatDate(lastQuarterStart);
                dateTo.value = formatDate(lastQuarterEnd);
                break;
                
            case 'clear':
                dateFrom.value = '';
                dateTo.value = '';
                break;
        }
        
        this.applyFilters();
    }
    
    exportToCSV() {
        // Get current filtered data
        const departmentFilter = document.getElementById('department-filter').value;
        const employeeFilter = document.getElementById('employee-filter').value;
        const monthFilter = document.getElementById('month-filter').value;
        const merchantFilter = document.getElementById('merchant-filter').value;
        const categoryFilter = document.getElementById('category-filter').value;
        const dateFrom = document.getElementById('date-from').value;
        const dateTo = document.getElementById('date-to').value;
        const memoFilter = document.getElementById('memo-filter').value.toLowerCase().trim();
        const spendCategoryFilter = document.getElementById('spend-category-filter').value;
        const spendProgramFilter = document.getElementById('spend-program-filter').value;
        const typeFilter = document.getElementById('type-filter').value;
        
        let filtered = [...this.filteredData];
        
        // Apply all filters (same logic as applyFilters)
        if (departmentFilter !== 'all') {
            filtered = filtered.filter(t => t.department === departmentFilter);
        }
        if (employeeFilter !== 'all') {
            filtered = filtered.filter(t => t.employee === employeeFilter);
        }
        if (typeFilter !== 'all') {
            filtered = filtered.filter(t => t.type === typeFilter);
        }
        
        // Apply month filter (takes precedence over date range if both are set)
        if (monthFilter !== 'all') {
            const [year, month] = monthFilter.split('-');
            filtered = filtered.filter(t => {
                const transactionYear = t.date.getFullYear();
                const transactionMonth = t.date.getMonth() + 1;
                return transactionYear === parseInt(year) && transactionMonth === parseInt(month);
            });
        } else {
            // Apply date range filter only if month filter is not set
            if (dateFrom) {
                const fromDate = new Date(dateFrom);
                filtered = filtered.filter(t => t.date >= fromDate);
            }
            
            if (dateTo) {
                const toDate = new Date(dateTo);
                filtered = filtered.filter(t => t.date <= toDate);
            }
        }
        
        if (merchantFilter !== 'all') {
            filtered = filtered.filter(t => t.merchant === merchantFilter);
        }
        if (categoryFilter !== 'all') {
            filtered = filtered.filter(t => t.accountingCategory === categoryFilter);
        }
        if (memoFilter) {
            filtered = filtered.filter(t => t.memo.toLowerCase().includes(memoFilter));
        }
        if (spendCategoryFilter !== 'all') {
            filtered = filtered.filter(t => t.spendCategory === spendCategoryFilter);
        }
        if (spendProgramFilter !== 'all') {
            filtered = filtered.filter(t => t.spendProgram === spendProgramFilter);
        }
        
        // Sort the data
        const sortedData = [...filtered].sort((a, b) => {
            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];
            
            if (this.sortColumn === 'date') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            } else if (this.sortColumn === 'amount') {
                aVal = parseFloat(aVal) || 0;
                bVal = parseFloat(bVal) || 0;
            } else {
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
            }
            
            if (this.sortDirection === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });
        
        // Create CSV content
        const headers = ['Date', 'Employee', 'Department', 'Merchant', 'Amount', 'Location', 'Type', 'Category', 'Memo'];
        const csvContent = [headers.join(',')];
        
        sortedData.forEach(transaction => {
            const row = [
                transaction.date.toLocaleDateString(),
                `"${transaction.employee}"`,
                `"${transaction.department}"`,
                `"${transaction.merchant}"`,
                transaction.amount,
                `"${transaction.location}"`,
                transaction.type === 'expense' ? 'Reimbursement' : 'Transaction',
                `"${transaction.accountingCategory}"`,
                `"${transaction.memo.replace(/"/g, '""')}"`
            ];
            csvContent.push(row.join(','));
        });
        
        // Create and download the file
        const csvString = csvContent.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `te-dashboard-export-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
    
    getSpendProgramName(spendProgramId) {
        if (!spendProgramId || !this.data.spendPrograms) return null;
        const program = this.data.spendPrograms.find(p => p.id === spendProgramId);
        return program ? (program.name || program.display_name) : null;
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TEDashboard();
});