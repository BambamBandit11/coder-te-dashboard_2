import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function SimpleDashboard() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        setUser(data.user)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Error: {error}</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Not signed in</p>
        <a href="/api/auth/google">Sign in with Google</a>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Simple Dashboard</title>
      </Head>
      
      <div style={{ padding: '2rem' }}>
        <h1>Simple Dashboard</h1>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Name:</strong> {user.name}</p>
        <img src={user.picture} alt="Profile" width="50" height="50" style={{ borderRadius: '50%' }} />
        
        <div style={{ marginTop: '2rem' }}>
          <button onClick={() => {
            document.cookie = 'session_token=; Path=/; Max-Age=0'
            window.location.href = '/auth/signin'
          }}>
            Sign Out
          </button>
        </div>
        
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0f0f0', borderRadius: '4px' }}>
          <h3>Session Data:</h3>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
      </div>
    </>
  )
}
