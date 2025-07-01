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
        document.getElementById('department-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('employee-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('month-filter').addEventListener('change', () => this.applyFilters());
        document.getElementById('merchant-filter').addEventListener('change', () => this.applyFilters());
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
        this.data.transactions.forEach(transaction => {
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
        
        this.filteredData = allTransactions;
        this.populateFilters();
        this.applyFilters();
    }

    populateFilters() {
        const departments = [...new Set(this.filteredData.map(t => t.department))].sort();
        const employees = [...new Set(this.filteredData.map(t => t.employee))].sort();
        const merchants = [...new Set(this.filteredData.map(t => t.merchant))].sort();
        
        this.populateSelect('department-filter', departments);
        this.populateSelect('employee-filter', employees);
        this.populateSelect('merchant-filter', merchants);
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
        
        let filtered = [...this.filteredData];
        
        if (departmentFilter !== 'all') {
            filtered = filtered.filter(t => t.department === departmentFilter);
        }
        
        if (employeeFilter !== 'all') {
            filtered = filtered.filter(t => t.employee === employeeFilter);
        }
        
        if (monthFilter !== 'all') {
            const [year, month] = monthFilter.split('-');
            filtered = filtered.filter(t => {
                const transactionYear = t.date.getFullYear();
                const transactionMonth = t.date.getMonth() + 1;
                return transactionYear === parseInt(year) && transactionMonth === parseInt(month);
            });
        }
        
        if (merchantFilter !== 'all') {
            filtered = filtered.filter(t => t.merchant === merchantFilter);
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
        
        document.getElementById('total-spend').textContent = this.formatCurrency(ytdTotal);
        document.getElementById('month-spend').textContent = this.formatCurrency(monthTotal);
        document.getElementById('transaction-count').textContent = data.length.toLocaleString();
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
        
        recentTransactions.forEach(transaction => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${transaction.date.toLocaleDateString()}</td>
                <td>${transaction.employee}</td>
                <td>${transaction.department}</td>
                <td>${transaction.merchant}</td>
                <td class="amount-cell">${this.formatCurrency(transaction.amount)}</td>
                <td>${transaction.location}</td>
            `;
            tbody.appendChild(row);
        });
        
        if (recentTransactions.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6" style="text-align: center; color: #6b7280; font-style: italic;">No transactions found</td>';
            tbody.appendChild(row);
        }
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
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TEDashboard();
});
