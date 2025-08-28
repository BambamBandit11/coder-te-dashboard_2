class TEDashboard {
    constructor() {
        this.data = {
            expenses: [],
            transactions: [],
            lastUpdated: null
        };
        this.filteredData = [];
        this.sortColumn = 'date';
        this.sortDirection = 'desc';
        this.isOnline = navigator.onLine;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.healthCheckInterval = null;
        this.lastSuccessfulFetch = null;
        
        // Initialize offline/online detection
        this.setupConnectivityMonitoring();
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadData();
        this.populateMonthFilter();
        this.startHealthMonitoring();
    }

    setupConnectivityMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showConnectivityStatus('online');
            this.loadData(); // Retry loading when back online
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showConnectivityStatus('offline');
        });
    }

    showConnectivityStatus(status) {
        const statusElement = document.getElementById('connectivity-status') || this.createConnectivityStatus();
        
        if (status === 'offline') {
            statusElement.textContent = '⚠️ Offline - Showing cached data';
            statusElement.className = 'connectivity-status offline';
            statusElement.style.display = 'block';
        } else {
            statusElement.textContent = '✅ Back online - Refreshing data';
            statusElement.className = 'connectivity-status online';
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }

    createConnectivityStatus() {
        const statusElement = document.createElement('div');
        statusElement.id = 'connectivity-status';
        statusElement.className = 'connectivity-status';
        statusElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #f59e0b;
            color: white;
            text-align: center;
            padding: 8px;
            z-index: 1000;
            display: none;
        `;
        document.body.insertBefore(statusElement, document.body.firstChild);
        return statusElement;
    }

    startHealthMonitoring() {
        // Check API health every 30 seconds
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000);
    }

    async performHealthCheck() {
        try {
            const response = await fetch('/api/ramp-data?health=true', {
                method: 'HEAD',
                timeout: 5000
            });
            
            if (response.ok) {
                this.updateHealthStatus('healthy');
            } else {
                this.updateHealthStatus('degraded');
            }
        } catch (error) {
            this.updateHealthStatus('unhealthy');
        }
    }

    updateHealthStatus(status) {
        const healthIndicator = document.getElementById('health-indicator') || this.createHealthIndicator();
        
        switch (status) {
            case 'healthy':
                healthIndicator.textContent = '🟢';
                healthIndicator.title = 'API is healthy';
                break;
            case 'degraded':
                healthIndicator.textContent = '🟡';
                healthIndicator.title = 'API is experiencing issues';
                break;
            case 'unhealthy':
                healthIndicator.textContent = '🔴';
                healthIndicator.title = 'API is unavailable';
                break;
        }
    }

    createHealthIndicator() {
        const indicator = document.createElement('span');
        indicator.id = 'health-indicator';
        indicator.style.cssText = 'margin-left: 10px; font-size: 12px; cursor: help;';
        
        const header = document.querySelector('header h1');
        if (header) {
            header.appendChild(indicator);
        }
        
        return indicator;
    }

    bindEvents() {
        document.getElementById('refresh-btn').addEventListener('click', () => this.refreshData());
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
        document.getElementById('type-filter').addEventListener('change', () => this.applyFilters());
        
        // CSV export button
        document.getElementById('export-csv').addEventListener('click', () => this.exportToCSV());
        
        // Sortable column headers
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => this.sortTable(header.dataset.sort));
        });
        
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
            // Show loading state
            this.showLoading(true);
            this.showStatus('Loading data...', 'info');
            
            // Try to load cached data first for immediate display
            const cachedData = this.loadCachedData();
            if (cachedData && this.isDataValid(cachedData)) {
                this.processData(cachedData);
                this.showStatus('Showing cached data. Checking for updates...', 'info');
            }
            
            // Always try to fetch fresh data
            await this.fetchDataWithRetry();
            
        } catch (error) {
            console.error('Error loading data:', error);
            
            // Try to use cached data as fallback
            const cachedData = this.loadCachedData();
            if (cachedData && this.isDataValid(cachedData)) {
                this.processData(cachedData);
                this.showStatus('Using cached data due to connection issues', 'warning');
            } else {
                this.showError('Unable to load data. Please check your connection and try again.');
            }
        } finally {
            this.showLoading(false);
        }
    }

    async fetchDataWithRetry() {
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            const startTime = Date.now();
            
            try {
                const data = await this.fetchData();
                const responseTime = Date.now() - startTime;
                
                if (data && this.isDataValid(data)) {
                    // Success! Cache the data and process it
                    this.cacheData(data);
                    this.processData(data);
                    this.lastSuccessfulFetch = new Date();
                    this.retryCount = 0;
                    this.showStatus('Data updated successfully', 'success');
                    
                    // Update connection indicator based on response time
                    if (responseTime < 2000) {
                        this.updateConnectionIndicator('online');
                    } else {
                        this.updateConnectionIndicator('slow');
                    }
                    
                    return data;
                } else {
                    throw new Error('Invalid data received from API');
                }
                
            } catch (error) {
                lastError = error;
                console.warn(`Fetch attempt ${attempt} failed:`, error.message);
                
                // Update connection indicator on error
                this.updateConnectionIndicator('offline');
                
                if (attempt < this.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    this.showStatus(`Retrying in ${delay/1000} seconds... (${attempt}/${this.maxRetries})`, 'warning');
                    await this.sleep(delay);
                } else {
                    this.retryCount++;
                    throw lastError;
                }
            }
        }
    }

    async fetchData() {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        try {
            const cacheBuster = new Date().getTime();
            const response = await fetch(`/api/ramp-data?t=${cacheBuster}`, {
                signal: controller.signal,
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate the response structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format');
            }
            
            return {
                expenses: data.expenses || [],
                transactions: data.transactions || [],
                spendCategories: data.spendCategories || [],
                spendPrograms: data.spendPrograms || [],
                receipts: data.receipts || [],
                memos: data.memos || [],
                lastUpdated: new Date().toISOString(),
                environment: data.environment || 'unknown',
                totalTransactions: data.totalTransactions || 0,
                totalReimbursements: data.totalReimbursements || 0
            };
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timed out after 15 seconds');
            }
            
            throw error;
        }
    }

    // Data persistence and validation utilities
    cacheData(data) {
        try {
            const cacheData = {
                ...data,
                cachedAt: new Date().toISOString(),
                version: '1.0'
            };
            localStorage.setItem('te-dashboard-data', JSON.stringify(cacheData));
            localStorage.setItem('te-dashboard-last-update', new Date().toISOString());
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    loadCachedData() {
        try {
            const cached = localStorage.getItem('te-dashboard-data');
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (error) {
            console.warn('Failed to load cached data:', error);
            // Clear corrupted cache
            localStorage.removeItem('te-dashboard-data');
        }
        return null;
    }

    isDataValid(data) {
        if (!data || typeof data !== 'object') return false;
        
        // Check if data is too old (more than 24 hours)
        if (data.cachedAt) {
            const cacheAge = Date.now() - new Date(data.cachedAt).getTime();
            if (cacheAge > 24 * 60 * 60 * 1000) {
                console.warn('Cached data is too old');
                return false;
            }
        }
        
        // Validate required fields
        return Array.isArray(data.expenses) && Array.isArray(data.transactions);
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('status-message') || this.createStatusElement();
        
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'block';
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }

    createStatusElement() {
        const statusElement = document.createElement('div');
        statusElement.id = 'status-message';
        statusElement.className = 'status-message';
        statusElement.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 1000;
            max-width: 400px;
            display: none;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        // Add CSS for different status types
        const style = document.createElement('style');
        style.textContent = `
            .status-message.info { background: #3b82f6; color: white; }
            .status-message.success { background: #10b981; color: white; }
            .status-message.warning { background: #f59e0b; color: white; }
            .status-message.error { background: #ef4444; color: white; }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(statusElement);
        return statusElement;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async refreshData() {
        try {
            // Disable refresh button during refresh
            const refreshBtn = document.getElementById('refresh-btn');
            const originalText = refreshBtn.textContent;
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Refreshing...';
            
            // Clear current data to force fresh fetch
            this.data = { expenses: [], transactions: [], lastUpdated: null };
            this.filteredData = [];
            
            // Show refreshing status
            this.showStatus('Refreshing data...', 'info');
            
            // Fetch fresh data
            await this.fetchDataWithRetry();
            
            // Success feedback
            refreshBtn.textContent = 'Refreshed!';
            refreshBtn.style.backgroundColor = '#10b981';
            
            setTimeout(() => {
                refreshBtn.textContent = originalText;
                refreshBtn.style.backgroundColor = '';
                refreshBtn.disabled = false;
            }, 2000);
            
        } catch (error) {
            console.error('Error refreshing data:', error);
            
            // Error feedback
            const refreshBtn = document.getElementById('refresh-btn');
            refreshBtn.textContent = 'Error - Try Again';
            refreshBtn.style.backgroundColor = '#ef4444';
            
            setTimeout(() => {
                refreshBtn.textContent = 'Refresh Data';
                refreshBtn.style.backgroundColor = '';
                refreshBtn.disabled = false;
            }, 3000);
            
            this.showStatus('Failed to refresh data. Please try again.', 'error');
        }
    }

    trimCategory(category) {
        if (!category) return 'Uncategorized';
        // Remove "Operating expense" prefix and any leading separators
        return category.replace(/^Operating expense\s*[>\-:]*\s*/i, '').trim() || 'Uncategorized';
    }

    processData(data = null) {
        if (!data) {
            data = this.data;
        }
        
        // Store the raw data
        this.data = {
            expenses: data.expenses || [],
            transactions: data.transactions || [],
            lastUpdated: data.lastUpdated || new Date().toISOString()
        };
        
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
                accountingCategory: this.trimCategory(glAccount?.name),
                merchantDescriptor: expense.merchant || 'Unknown',
                state: expense.state || 'Unknown',
                cardHolderLocation: 'N/A', // Reimbursements don't have card holder location
                memo: expense.memo || 'No memo',
                spendCategory: this.trimCategory(expense.sk_category_name),
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
                accountingCategory: this.trimCategory(glAccount?.category_name),
                merchantDescriptor: transaction.merchant_descriptor || transaction.merchant_name || 'Unknown',
                state: transaction.state || 'Unknown',
                cardHolderLocation: transaction.card_holder?.location_name || 'Unknown',
                memo: transaction.memo || 'No memo',
                spendCategory: this.trimCategory(transaction.sk_category_name),
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
        const typeFilter = document.getElementById('type-filter').value;
        
        let filtered = [...this.filteredData];
        
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

    sortTable(column) {
        // Toggle sort direction if clicking the same column
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        
        // Update visual indicators
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });
        
        const currentHeader = document.querySelector(`[data-sort="${column}"]`);
        currentHeader.classList.add(`sort-${this.sortDirection}`);
        
        // Apply current filters to get the data to sort
        this.applyFilters();
    }

    updateTransactionsTable(data) {
        const tbody = document.querySelector('#transactions tbody');
        tbody.innerHTML = '';
        
        // Sort the data based on current sort settings
        const sortedData = [...data].sort((a, b) => {
            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];
            
            // Handle different data types
            if (this.sortColumn === 'date') {
                aVal = a.date.getTime();
                bVal = b.date.getTime();
            } else if (this.sortColumn === 'amount') {
                aVal = parseFloat(a.amount);
                bVal = parseFloat(b.amount);
            } else {
                // String comparison
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
            }
            
            if (this.sortDirection === 'asc') {
                return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            } else {
                return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
            }
        });
        
        // Show latest 50 transactions
        const recentTransactions = sortedData.slice(0, 50);
        
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
        if (monthFilter !== 'all') {
            const [year, month] = monthFilter.split('-');
            filtered = filtered.filter(t => {
                const transactionYear = t.date.getFullYear();
                const transactionMonth = t.date.getMonth() + 1;
                return transactionYear === parseInt(year) && transactionMonth === parseInt(month);
            });
        } else if (dateFrom || dateTo) {
            filtered = filtered.filter(t => {
                const transactionDate = t.date;
                if (dateFrom && transactionDate < new Date(dateFrom)) return false;
                if (dateTo && transactionDate > new Date(dateTo + 'T23:59:59')) return false;
                return true;
            });
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
                aVal = a.date.getTime();
                bVal = b.date.getTime();
            } else if (this.sortColumn === 'amount') {
                aVal = parseFloat(a.amount);
                bVal = parseFloat(b.amount);
            } else {
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
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
        
        // Download CSV file
        const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `te-dashboard-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
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

    updateLastUpdated() {
        const lastUpdatedElement = document.getElementById('last-updated');
        if (lastUpdatedElement && this.data.lastUpdated) {
            const date = new Date(this.data.lastUpdated);
            lastUpdatedElement.textContent = `Last updated: ${date.toLocaleString()}`;
            
            // Update data freshness indicator
            this.updateDataFreshnessIndicator(date);
        }
    }

    updateDataFreshnessIndicator(lastUpdate) {
        const indicator = document.getElementById('data-freshness');
        if (!indicator) return;
        
        const now = new Date();
        const ageMinutes = (now - lastUpdate) / (1000 * 60);
        
        if (ageMinutes < 5) {
            indicator.textContent = '🟢'; // Fresh (green)
            indicator.title = 'Data is fresh (updated within 5 minutes)';
        } else if (ageMinutes < 30) {
            indicator.textContent = '🟡'; // Moderate (yellow)
            indicator.title = `Data is ${Math.round(ageMinutes)} minutes old`;
        } else {
            indicator.textContent = '🔴'; // Stale (red)
            indicator.title = `Data is ${Math.round(ageMinutes)} minutes old - consider refreshing`;
        }
    }

    updateConnectionIndicator(status) {
        const indicator = document.getElementById('connection-status');
        if (!indicator) return;
        
        switch (status) {
            case 'online':
                indicator.textContent = '🟢';
                indicator.title = 'Connected - API is responsive';
                break;
            case 'slow':
                indicator.textContent = '🟡';
                indicator.title = 'Connected - API is slow';
                break;
            case 'offline':
                indicator.textContent = '🔴';
                indicator.title = 'Offline - Using cached data';
                break;
            default:
                indicator.textContent = '🌐';
                indicator.title = 'Connection status unknown';
        }
    }

    showError(message) {
        this.showStatus(message, 'error');
        
        // Also update the main error display
        const errorElement = document.getElementById('error');
        if (errorElement) {
            errorElement.querySelector('p').textContent = message;
            errorElement.classList.remove('hidden');
        }
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