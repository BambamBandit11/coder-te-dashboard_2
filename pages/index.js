import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.ok ? r.json() : { user: null })
      .then((data) => {
        setUser(data.user || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Session fetch error:', err);
        setError('Failed to load session');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loading-container" style={{gap: '1rem'}}>
        <p>You must sign in to continue.</p>
        <a href="/api/auth/google" className="btn-primary" style={{textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: 6}}>Sign in with Google</a>
      </div>
    );
  }

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
            <div className="user-info">
              <span className="user-email">{user.email}</span>
              <button className="sign-out-btn" onClick={() => {
                document.cookie = 'session_token=; Path=/; Max-Age=0';
                if (typeof window !== 'undefined') window.location.href = '/auth/signin';
              }}>
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <main className="main">
          {error && (
            <div className="error">
              {error}
            </div>
          )}
          
          <div className="welcome-card">
            <h2>Welcome, {user.name}!</h2>
            <p>You are successfully signed in to the Coder T&E Dashboard.</p>
            
            <div className="user-details">
              <div className="user-avatar">
                <img src={user.picture} alt="Profile" width="80" height="80" style={{ borderRadius: '50%' }} />
              </div>
              <div className="user-info-details">
                <p><strong>Email:</strong> {user.email}</p>
                <p><strong>Name:</strong> {user.name}</p>
                <p><strong>Status:</strong> Authenticated ✅</p>
              </div>
            </div>
            
            <div className="next-steps">
              <h3>Next Steps:</h3>
              <ul>
                <li>Connect to your expense management system</li>
                <li>Configure data sources (Ramp, etc.)</li>
                <li>Set up expense categories and approval workflows</li>
              </ul>
            </div>
          </div>
        </main>
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
          flex-wrap: wrap;
        }
        
        .user-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.5rem 1rem;
          background: #f3f4f6;
          border-radius: 6px;
        }
        
        .user-email {
          font-size: 0.875rem;
          color: #374151;
          font-weight: 500;
        }
        
        .sign-out-btn {
          background: #6b7280;
          color: white;
          border: none;
          padding: 0.375rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .sign-out-btn:hover {
          background: #4b5563;
        }
        
        .main {
          padding: 2rem;
          background: #f9fafb;
          min-height: calc(100vh - 100px);
        }
        
        .welcome-card {
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          max-width: 800px;
          margin: 0 auto;
        }
        
        .welcome-card h2 {
          color: #374151;
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
        }
        
        .welcome-card p {
          color: #6b7280;
          margin: 0 0 2rem 0;
        }
        
        .user-details {
          display: flex;
          align-items: center;
          gap: 2rem;
          padding: 1.5rem;
          background: #f9fafb;
          border-radius: 6px;
          margin-bottom: 2rem;
        }
        
        .user-info-details p {
          margin: 0.5rem 0;
          color: #374151;
        }
        
        .next-steps {
          border-top: 1px solid #e5e7eb;
          padding-top: 2rem;
        }
        
        .next-steps h3 {
          color: #374151;
          font-size: 1.2rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
        }
        
        .next-steps ul {
          color: #6b7280;
          padding-left: 1.5rem;
        }
        
        .next-steps li {
          margin: 0.5rem 0;
        }
        
        .loading-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #f9fafb;
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
        
        .btn-primary:hover {
          background: #1d4ed8;
        }
        
        @media (max-width: 768px) {
          .header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }
          
          .user-details {
            flex-direction: column;
            text-align: center;
          }
          
          .main {
            padding: 1rem;
          }
        }
      `}</style>
    </>
  );
}
