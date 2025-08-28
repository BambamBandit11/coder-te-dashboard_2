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
