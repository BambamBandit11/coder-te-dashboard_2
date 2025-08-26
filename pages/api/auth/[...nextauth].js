import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Only allow @coder.com email addresses
      if (user.email && user.email.endsWith('@coder.com')) {
        return true
      }
      return false
    }
  },
  session: {
    strategy: 'jwt',
  },
})