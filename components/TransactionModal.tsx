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
