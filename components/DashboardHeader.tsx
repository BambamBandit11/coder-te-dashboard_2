interface DashboardHeaderProps {
  onRefresh: () => void;
  lastUpdated?: string;
  loading?: boolean;
}

export function DashboardHeader({ onRefresh, lastUpdated, loading }: DashboardHeaderProps) {
  return (
    <header style={{ 
      background: 'white', 
      padding: '1.5rem 2rem', 
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      <h1 style={{ color: '#2563eb', fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
        Travel & Entertainment Dashboard
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span>Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : 'Never'}</span>
        <button 
          onClick={onRefresh}
          disabled={loading}
          style={{
            background: '#2563eb',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </header>
  );
}
