export default function handler(req, res) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 
        `${process.env.GOOGLE_CLIENT_ID.substring(0, 10)}...${process.env.GOOGLE_CLIENT_ID.slice(-10)}` : 
        'MISSING',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 
        `${process.env.GOOGLE_CLIENT_SECRET.substring(0, 6)}...` : 
        'MISSING',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 
        `${process.env.NEXTAUTH_SECRET.substring(0, 6)}...` : 
        'MISSING',
      SESSION_SECRET: process.env.SESSION_SECRET ? 
        `${process.env.SESSION_SECRET.substring(0, 6)}...` : 
        'MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'MISSING',
      NODE_ENV: process.env.NODE_ENV || 'unknown'
    },
    checks: {
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasAnySecret: !!(process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET),
      googleClientIdFormat: process.env.GOOGLE_CLIENT_ID ? 
        process.env.GOOGLE_CLIENT_ID.includes('googleusercontent.com') : false,
      googleClientSecretFormat: process.env.GOOGLE_CLIENT_SECRET ? 
        process.env.GOOGLE_CLIENT_SECRET.startsWith('GOCSPX-') : false
    }
  }
  
  const allGood = diagnostics.checks.hasGoogleClientId && 
                  diagnostics.checks.hasGoogleClientSecret && 
                  diagnostics.checks.hasAnySecret
  
  res.status(200).json({
    status: allGood ? 'OK' : 'ISSUES_FOUND',
    ...diagnostics
  })
}
