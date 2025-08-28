export function FilterPanel({ filters, onFilterChange, onClearAll, data }: any) {
  return (
    <div style={{ 
      background: 'white', 
      padding: '1.5rem', 
      borderRadius: '8px', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
      marginBottom: '2rem' 
    }}>
      <p>Filter Panel - Coming Soon with Status Filter!</p>
      <button onClick={onClearAll}>Clear All Filters</button>
    </div>
  );
}

export function SummaryCards({ data }: any) {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
      gap: '1rem', 
      marginBottom: '2rem' 
    }}>
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', textAlign: 'center' }}>
        <h3>Total Transactions</h3>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2563eb' }}>
          {data?.length || 0}
        </div>
      </div>
    </div>
  );
}

export function TransactionsTable({ data, loading, onTransactionClick }: any) {
  if (loading) {
    return <div>Loading transactions...</div>;
  }

  return (
    <div style={{ 
      background: 'white', 
      padding: '1.5rem', 
      borderRadius: '8px', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
    }}>
      <h2>Recent Transactions</h2>
      <p>Found {data?.length || 0} transactions</p>
      <p>Full table with Status column coming soon!</p>
    </div>
  );
}

export function TransactionModal({ transaction, onClose }: any) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '2rem',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%'
      }}>
        <h3>Transaction Details</h3>
        <p>Transaction modal with Status field coming soon!</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
