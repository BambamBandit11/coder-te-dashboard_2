import { useState, useEffect } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { FilterPanel } from './FilterPanel';
import { SummaryCards } from './SummaryCards';
import { TransactionsTable } from './TransactionsTable';
import { TransactionModal } from './TransactionModal';
import { useTEData } from '../hooks/useTEData';
import { useFilters } from '../hooks/useFilters';
import styles from '../styles/Dashboard.module.css';

export function TEDashboard() {
  const { data, loading, error, refreshData } = useTEData();
  const { filteredData, filters, updateFilter, clearAllFilters } = useFilters(data);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTransactionClick = (transaction: any) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };

  if (error) {
    return (
      <div className={styles.container}>
        <DashboardHeader onRefresh={refreshData} lastUpdated={data?.lastUpdated} />
        <div className={styles.error}>
          <h2>Unable to load data</h2>
          <p>{error}</p>
          <button onClick={refreshData} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <DashboardHeader 
        onRefresh={refreshData} 
        lastUpdated={data?.lastUpdated}
        loading={loading}
      />
      
      <main className={styles.main}>
        <FilterPanel 
          filters={filters}
          onFilterChange={updateFilter}
          onClearAll={clearAllFilters}
          data={data}
        />
        
        <SummaryCards data={filteredData} />
        
        <TransactionsTable 
          data={filteredData}
          loading={loading}
          onTransactionClick={handleTransactionClick}
        />
      </main>

      {isModalOpen && selectedTransaction && (
        <TransactionModal 
          transaction={selectedTransaction}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
