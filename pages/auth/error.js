import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

export default function AuthError() {
  const router = useRouter()
  const { error } = router.query

  const getErrorMessage = (error) => {
    switch (error) {
      case 'AccessDenied':
        return {
          title: 'Access Denied',
          message: 'Only @coder.com email addresses are allowed to access this dashboard.',
          suggestion: 'Please sign in with your Coder company Google account.'
        }
      case 'Configuration':
        return {
          title: 'Configuration Error',
          message: 'There was a problem with the authentication configuration.',
          suggestion: 'Please contact your administrator.'
        }
      default:
        return {
          title: 'Authentication Error',
          message: 'An error occurred during authentication.',
          suggestion: 'Please try signing in again.'
        }
    }
  }

  const errorInfo = getErrorMessage(error)

  return (
    <>
      <Head>
        <title>Authentication Error - Coder T&E Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="error-container">
        <div className="error-card">
          <div className="error-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
              <line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" strokeWidth="2"/>
              <line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" strokeWidth="2"/>
            </svg>
          </div>
          
          <h1>{errorInfo.title}</h1>
          <p className="error-message">{errorInfo.message}</p>
          <p className="error-suggestion">{errorInfo.suggestion}</p>
          
          <div className="error-actions">
            <Link href="/auth/signin" className="retry-button">
              Try Again
            </Link>
          </div>
        </div>
      </div>
      
      <style jsx>{`
        .error-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem;
        }
        
        .error-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          padding: 3rem;
          max-width: 400px;
          width: 100%;
          text-align: center;
        }
        
        .error-icon {
          margin-bottom: 1.5rem;
        }
        
        h1 {
          color: #374151;
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 1rem 0;
        }
        
        .error-message {
          color: #6b7280;
          margin: 0 0 1rem 0;
          font-size: 1rem;
        }
        
        .error-suggestion {
          color: #9ca3af;
          margin: 0 0 2rem 0;
          font-size: 0.875rem;
        }
        
        .retry-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          transition: background 0.2s;
        }
        
        .retry-button:hover {
          background: #1d4ed8;
        }
        
        @media (max-width: 480px) {
          .error-card {
            padding: 2rem;
          }
        }
      `}</style>
    </>
  )
}
