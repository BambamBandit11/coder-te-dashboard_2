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
